/**
 * Orders repository.
 *
 * createOrder executes the full checkout transaction atomically in a single
 * sql.begin() block per design.md §4:
 *   1. Lock cart items FOR UPDATE (by session_id)
 *   2. Compute unit prices server-side
 *   3. INSERT customer_order (session_id, email, optional user_id)
 *   4. INSERT order_line_items
 *   5. DELETE cart_item rows (by session_id)
 *
 * All other functions are read-only or simple updates.
 *
 * Requirements: AC5.6, AC6.1–AC6.8, AC8.1–AC8.10
 * Design: specs/cart-and-order/design.md §4, §5
 */
import { randomBytes } from 'crypto';
import { sql } from '../db.js';
import type { CustomerOrderRow, OrderLineItemRow } from '../types/entities.js';
import { sendOrderConfirmation } from '../lib/email.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderWithLineItems extends CustomerOrderRow {
  lineItems: OrderLineItemWithSummary[];
  itemCount: number;
}

export interface BundleProductItem {
  slot_code: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  form_factor_snapshot: string;
  quantity_per_bag: number;
  display_order: number;
  description_snapshot: string | null;
}

export interface OrderLineItemWithSummary extends OrderLineItemRow {
  // Joined from generated_bundle for display
  interest: string;
  requested_age: number;
  party_type: string;
  bundle_public_id: string;
  // Joined from generated_bundle_item (populated by findOrderByPublicId; empty in createOrder/confirmOrder)
  bundleItems: BundleProductItem[];
}

export interface PaginatedOrders {
  orders: (CustomerOrderRow & { item_count: string })[];
  total: number;
  page: number;
  limit: number;
}

// ─── Locked cart row shape used inside transaction ────────────────────────────

interface LockedCartItem {
  id: number;
  generated_bundle_id: number;
  upgrade_tier: string;
  gift_bag_option_id: number | null;
  quantity: number;
}

interface BundlePriceData {
  id: number;
  base_retail_price: string;
  standard_retail_adj: string | null;
  premium_retail_adj: string | null;
}

interface GiftBagPriceData {
  id: number;
  name: string;
  retail_price_adjustment: string;
}

// ─── createOrder ──────────────────────────────────────────────────────────────

/**
 * Atomic checkout transaction.
 * Cart is looked up by sessionId. userId is optional (set when user is signed in).
 * Throws an Error with message 'CART_EMPTY' if the cart has no items.
 * Requirements: AC5.6, design.md §4
 */
export async function createOrder(
  sessionId: string,
  email: string,
  name: string | null,
  userId: string | null,
): Promise<OrderWithLineItems> {
  return sql.begin(async (tx) => {
    // Step 1: Lock cart items FOR UPDATE to prevent duplicate checkout races
    const cartItems = await tx<LockedCartItem[]>`
      SELECT id, generated_bundle_id, upgrade_tier, gift_bag_option_id, quantity
      FROM cart_item
      WHERE session_id = ${sessionId}
      FOR UPDATE
    `;

    if (cartItems.length === 0) {
      throw new Error('CART_EMPTY');
    }

    // Step 2: Fetch price data for all bundles in one query
    const bundleIds = cartItems.map(c => c.generated_bundle_id);
    const bundles = await tx<BundlePriceData[]>`
      SELECT
        gb.id,
        gb.base_retail_price,
        gbu.standard_retail_adjustment_snapshot AS standard_retail_adj,
        gbu.retail_price_adjustment_snapshot    AS premium_retail_adj
      FROM generated_bundle gb
      LEFT JOIN generated_bundle_upgrade gbu ON gbu.generated_bundle_id = gb.id
      WHERE gb.id IN ${tx(bundleIds)}
    `;
    const bundleMap = new Map(bundles.map(b => [b.id, b]));

    // Fetch gift bag price data for non-null options
    const giftBagIds = [...new Set(
      cartItems
        .map(c => c.gift_bag_option_id)
        .filter((id): id is number => id !== null),
    )];

    const giftBagMap = new Map<number, GiftBagPriceData>();
    if (giftBagIds.length > 0) {
      const giftBags = await tx<GiftBagPriceData[]>`
        SELECT id, name, retail_price_adjustment
        FROM gift_bag_option
        WHERE id IN ${tx(giftBagIds)}
      `;
      giftBags.forEach(gb => giftBagMap.set(gb.id, gb));
    }

    // Step 2d: Compute unit prices
    const lineItemInputs = cartItems.map(cartItem => {
      const bundle = bundleMap.get(cartItem.generated_bundle_id);
      if (!bundle) throw new Error(`Bundle not found: ${cartItem.generated_bundle_id}`);

      const base = Number(bundle.base_retail_price ?? 0);

      let upgradeAdj = 0;
      if (cartItem.upgrade_tier === 'PREMIUM' && bundle.premium_retail_adj != null && bundle.standard_retail_adj != null) {
        upgradeAdj = Number(bundle.premium_retail_adj) - Number(bundle.standard_retail_adj);
      } else if (cartItem.upgrade_tier === 'STANDARD' && bundle.standard_retail_adj != null) {
        upgradeAdj = Number(bundle.standard_retail_adj);
      }

      const giftBag = cartItem.gift_bag_option_id != null
        ? giftBagMap.get(cartItem.gift_bag_option_id) ?? null
        : null;

      const giftBagAdj = giftBag ? Number(giftBag.retail_price_adjustment) : 0;
      const unitPrice = Math.round((base + upgradeAdj + giftBagAdj) * 100) / 100;
      const lineTotal = Math.round(unitPrice * cartItem.quantity * 100) / 100;

      return {
        generated_bundle_id: cartItem.generated_bundle_id,
        upgrade_tier: cartItem.upgrade_tier,
        gift_bag_option_id: cartItem.gift_bag_option_id,
        quantity: cartItem.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        gift_bag_name_snapshot: giftBag?.name ?? null,
        gift_bag_price_snapshot: giftBag ? Number(giftBag.retail_price_adjustment) : null,
      };
    });

    const subtotal = Math.round(
      lineItemInputs.reduce((s, li) => s + li.line_total, 0) * 100,
    ) / 100;

    // Step 3: INSERT customer_order
    const publicId = `ord_${randomBytes(6).toString('hex')}`; // ord_<12-char-hex>

    const orderRows = await tx<CustomerOrderRow[]>`
      INSERT INTO customer_order (
        public_id, session_id, user_id, status,
        subtotal, total, currency,
        customer_email, customer_name
      ) VALUES (
        ${publicId},
        ${sessionId},
        ${userId},
        'PENDING',
        ${subtotal},
        ${subtotal},
        'USD',
        ${email},
        ${name}
      )
      RETURNING *
    `;
    const order = orderRows[0];

    // Step 4: INSERT order_line_items
    const lineItemRows = lineItemInputs.map(li => ({
      customer_order_id: order.id,
      generated_bundle_id: li.generated_bundle_id,
      upgrade_tier: li.upgrade_tier,
      gift_bag_option_id: li.gift_bag_option_id,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
      gift_bag_name_snapshot: li.gift_bag_name_snapshot,
      gift_bag_price_snapshot: li.gift_bag_price_snapshot,
    }));

    await tx`INSERT INTO order_line_item ${tx(lineItemRows)}`;

    // Step 5: DELETE cart items (atomic — cart cleared only on commit)
    await tx`DELETE FROM cart_item WHERE session_id = ${sessionId}`;

    // Fetch the inserted line items with bundle summary for the response
    const lineItemsRaw = await tx<Omit<OrderLineItemWithSummary, 'bundleItems'>[]>`
      SELECT
        oli.*,
        gb.interest,
        gb.requested_age,
        gb.party_type,
        gb.public_id AS bundle_public_id
      FROM order_line_item oli
      JOIN generated_bundle gb ON gb.id = oli.generated_bundle_id
      WHERE oli.customer_order_id = ${order.id}
    `;
    const lineItems: OrderLineItemWithSummary[] = lineItemsRaw.map(li => ({ ...li, bundleItems: [] }));

    return {
      ...order,
      lineItems,
      itemCount: lineItems.reduce((s, li) => s + li.quantity, 0),
    };
  });
}

// ─── listUserOrders ───────────────────────────────────────────────────────────

/**
 * Paginated orders for a user, newest first.
 * Requirements: AC6.6, AC6.8
 */
export async function listUserOrders(
  userId: string,
  page: number,
  limit: number,
): Promise<PaginatedOrders> {
  const offset = (page - 1) * limit;

  const [orders, countRows] = await Promise.all([
    sql<(CustomerOrderRow & { item_count: string })[]>`
      SELECT
        co.*,
        COUNT(oli.id) AS item_count
      FROM customer_order co
      LEFT JOIN order_line_item oli ON oli.customer_order_id = co.id
      WHERE co.user_id = ${userId}
      GROUP BY co.id
      ORDER BY co.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql<{ total: string }[]>`
      SELECT COUNT(*) AS total FROM customer_order WHERE user_id = ${userId}
    `,
  ]);

  return {
    orders,
    total: Number(countRows[0]?.total ?? 0),
    page,
    limit,
  };
}

// ─── findOrderByPublicId ──────────────────────────────────────────────────────

/**
 * Fetches a single order with its line items by publicId.
 * No ownership enforcement — publicId is unguessable (12-char hex).
 * The optional userId param is accepted for future use but not enforced.
 * Requirements: AC6.2, AC6.3
 */
export async function findOrderByPublicId(
  publicId: string,
  userId?: string,
): Promise<OrderWithLineItems | null> {
  // Intentionally NOT filtering by userId — publicId is the auth mechanism.
  // userId param retained for future use (e.g., ownership verification in list endpoint).
  void userId;

  const orderRows = await sql<CustomerOrderRow[]>`
    SELECT * FROM customer_order
    WHERE public_id = ${publicId}
  `;

  if (orderRows.length === 0) return null;

  const order = orderRows[0];

  const lineItemsRaw = await sql<Omit<OrderLineItemWithSummary, 'bundleItems'>[]>`
    SELECT
      oli.*,
      gb.interest,
      gb.requested_age,
      gb.party_type,
      gb.public_id AS bundle_public_id
    FROM order_line_item oli
    JOIN generated_bundle gb ON gb.id = oli.generated_bundle_id
    WHERE oli.customer_order_id = ${order.id}
    ORDER BY oli.id ASC
  `;

  // Fetch product items for all bundles in this order in one query
  const bundleIds = [...new Set(lineItemsRaw.map(li => li.generated_bundle_id))];
  const bundleProductRows = bundleIds.length > 0
    ? await sql<(BundleProductItem & { generated_bundle_id: number })[]>`
        SELECT
          generated_bundle_id,
          slot_code,
          product_name_snapshot,
          sku_snapshot,
          form_factor_snapshot,
          quantity_per_bag,
          display_order,
          description_snapshot
        FROM generated_bundle_item
        WHERE generated_bundle_id IN ${sql(bundleIds)}
        ORDER BY generated_bundle_id, display_order ASC
      `
    : [];

  // Group bundle product items by bundle id
  const bundleItemsMap = new Map<number, BundleProductItem[]>();
  for (const row of bundleProductRows) {
    const { generated_bundle_id, ...item } = row;
    const existing = bundleItemsMap.get(generated_bundle_id) ?? [];
    existing.push(item);
    bundleItemsMap.set(generated_bundle_id, existing);
  }

  const lineItems: OrderLineItemWithSummary[] = lineItemsRaw.map(li => ({
    ...li,
    bundleItems: bundleItemsMap.get(li.generated_bundle_id) ?? [],
  }));

  return {
    ...order,
    lineItems,
    itemCount: lineItems.reduce((s, li) => s + li.quantity, 0),
  };
}

// ─── listAllOrders (admin) ────────────────────────────────────────────────────

export interface AdminOrderFilters {
  status?: string;
  page: number;
  limit: number;
}

/**
 * Admin: all orders with customer_email, filterable by status.
 * Requirements: AC8.2–AC8.4
 */
export async function listAllOrders(
  filters: AdminOrderFilters,
): Promise<PaginatedOrders> {
  const offset = (filters.page - 1) * filters.limit;

  const [orders, countRows] = await Promise.all([
    sql<(CustomerOrderRow & { item_count: string })[]>`
      SELECT
        co.*,
        COUNT(oli.id) AS item_count
      FROM customer_order co
      LEFT JOIN order_line_item oli ON oli.customer_order_id = co.id
      ${filters.status ? sql`WHERE co.status = ${filters.status}` : sql``}
      GROUP BY co.id
      ORDER BY co.created_at DESC
      LIMIT ${filters.limit} OFFSET ${offset}
    `,
    sql<{ total: string }[]>`
      SELECT COUNT(*) AS total
      FROM customer_order
      ${filters.status ? sql`WHERE status = ${filters.status}` : sql``}
    `,
  ]);

  return {
    orders,
    total: Number(countRows[0]?.total ?? 0),
    page: filters.page,
    limit: filters.limit,
  };
}

// ─── updateOrderStatus (admin) ────────────────────────────────────────────────

/**
 * Admin: advance order status.
 * Returns the updated order or null if not found.
 * Requirements: AC8.8, AC9.9
 */
export async function updateOrderStatus(
  publicId: string,
  status: string,
): Promise<CustomerOrderRow | null> {
  const rows = await sql<CustomerOrderRow[]>`
    UPDATE customer_order
    SET status = ${status}, updated_at = now()
    WHERE public_id = ${publicId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

// ─── confirmOrder (Stripe webhook) ───────────────────────────────────────────

export interface ConfirmOrderParams {
  paymentIntentId: string;
  sessionId: string;
  email: string;
  name: string | null;
  userId: string | null;
  shippingStreet: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
}

/**
 * Called by the Stripe webhook after payment_intent.succeeded.
 * Runs the same atomic transaction as createOrder but:
 *   - status starts as 'CONFIRMED' (payment already verified)
 *   - payment_intent_id and payment_status are set
 *   - shipping address columns are populated
 *   - sends confirmation email after commit
 *
 * Returns the created order, or null if the cart is already empty
 * (idempotency guard — webhook may fire more than once).
 *
 * Design: specs/payment/design.md §4.3
 */
export async function confirmOrder(
  params: ConfirmOrderParams,
): Promise<OrderWithLineItems | null> {
  const {
    paymentIntentId, sessionId, email, name, userId,
    shippingStreet, shippingCity, shippingState, shippingZip, shippingCountry,
  } = params;

  // Idempotency: if an order already exists for this payment intent, return it
  const existing = await sql<CustomerOrderRow[]>`
    SELECT * FROM customer_order WHERE payment_intent_id = ${paymentIntentId}
  `;
  if (existing.length > 0) {
    const order = existing[0];
    const lineItemsRaw = await sql<Omit<OrderLineItemWithSummary, 'bundleItems'>[]>`
      SELECT oli.*, gb.interest, gb.requested_age, gb.party_type, gb.public_id AS bundle_public_id
      FROM order_line_item oli
      JOIN generated_bundle gb ON gb.id = oli.generated_bundle_id
      WHERE oli.customer_order_id = ${order.id}
      ORDER BY oli.id ASC
    `;
    const lineItems: OrderLineItemWithSummary[] = lineItemsRaw.map(li => ({ ...li, bundleItems: [] }));
    return { ...order, lineItems, itemCount: lineItems.reduce((s, li) => s + li.quantity, 0) };
  }

  const result = await sql.begin(async (tx) => {
    // Step 1: Lock cart items
    const cartItems = await tx<LockedCartItem[]>`
      SELECT id, generated_bundle_id, upgrade_tier, gift_bag_option_id, quantity
      FROM cart_item
      WHERE session_id = ${sessionId}
      FOR UPDATE
    `;

    if (cartItems.length === 0) return null; // Cart already cleared (idempotency)

    // Step 2: Fetch price data
    const bundleIds = cartItems.map(c => c.generated_bundle_id);
    const bundles = await tx<BundlePriceData[]>`
      SELECT
        gb.id,
        gb.base_retail_price,
        gbu.standard_retail_adjustment_snapshot AS standard_retail_adj,
        gbu.retail_price_adjustment_snapshot    AS premium_retail_adj
      FROM generated_bundle gb
      LEFT JOIN generated_bundle_upgrade gbu ON gbu.generated_bundle_id = gb.id
      WHERE gb.id IN ${tx(bundleIds)}
    `;
    const bundleMap = new Map(bundles.map(b => [b.id, b]));

    const giftBagIds = [...new Set(
      cartItems.map(c => c.gift_bag_option_id).filter((id): id is number => id !== null),
    )];
    const giftBagMap = new Map<number, GiftBagPriceData>();
    if (giftBagIds.length > 0) {
      const giftBags = await tx<GiftBagPriceData[]>`
        SELECT id, name, retail_price_adjustment FROM gift_bag_option WHERE id IN ${tx(giftBagIds)}
      `;
      giftBags.forEach(gb => giftBagMap.set(gb.id, gb));
    }

    // Step 2d: Compute unit prices
    const lineItemInputs = cartItems.map(cartItem => {
      const bundle = bundleMap.get(cartItem.generated_bundle_id);
      if (!bundle) throw new Error(`Bundle not found: ${cartItem.generated_bundle_id}`);
      const base = Number(bundle.base_retail_price ?? 0);
      let upgradeAdj = 0;
      if (cartItem.upgrade_tier === 'PREMIUM' && bundle.premium_retail_adj != null && bundle.standard_retail_adj != null) {
        upgradeAdj = Number(bundle.premium_retail_adj) - Number(bundle.standard_retail_adj);
      } else if (cartItem.upgrade_tier === 'STANDARD' && bundle.standard_retail_adj != null) {
        upgradeAdj = Number(bundle.standard_retail_adj);
      }
      const giftBag = cartItem.gift_bag_option_id != null ? giftBagMap.get(cartItem.gift_bag_option_id) ?? null : null;
      const giftBagAdj = giftBag ? Number(giftBag.retail_price_adjustment) : 0;
      const unitPrice = Math.round((base + upgradeAdj + giftBagAdj) * 100) / 100;
      const lineTotal = Math.round(unitPrice * cartItem.quantity * 100) / 100;
      return {
        generated_bundle_id: cartItem.generated_bundle_id,
        upgrade_tier: cartItem.upgrade_tier,
        gift_bag_option_id: cartItem.gift_bag_option_id,
        quantity: cartItem.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        gift_bag_name_snapshot: giftBag?.name ?? null,
        gift_bag_price_snapshot: giftBag ? Number(giftBag.retail_price_adjustment) : null,
      };
    });

    const subtotal = Math.round(lineItemInputs.reduce((s, li) => s + li.line_total, 0) * 100) / 100;
    const publicId = `ord_${randomBytes(6).toString('hex')}`;

    // Step 3: INSERT customer_order
    const orderRows = await tx<CustomerOrderRow[]>`
      INSERT INTO customer_order (
        public_id, session_id, user_id, status,
        subtotal, total, currency,
        customer_email, customer_name,
        payment_intent_id, payment_status,
        shipping_street, shipping_city, shipping_state, shipping_zip, shipping_country
      ) VALUES (
        ${publicId}, ${sessionId}, ${userId}, 'CONFIRMED',
        ${subtotal}, ${subtotal}, 'USD',
        ${email}, ${name},
        ${paymentIntentId}, 'succeeded',
        ${shippingStreet}, ${shippingCity}, ${shippingState}, ${shippingZip}, ${shippingCountry}
      )
      RETURNING *
    `;
    const order = orderRows[0];

    // Step 4: INSERT order_line_items
    const lineItemRows = lineItemInputs.map(li => ({
      customer_order_id: order.id,
      generated_bundle_id: li.generated_bundle_id,
      upgrade_tier: li.upgrade_tier,
      gift_bag_option_id: li.gift_bag_option_id,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
      gift_bag_name_snapshot: li.gift_bag_name_snapshot,
      gift_bag_price_snapshot: li.gift_bag_price_snapshot,
    }));
    await tx`INSERT INTO order_line_item ${tx(lineItemRows)}`;

    // Step 5: DELETE cart items
    await tx`DELETE FROM cart_item WHERE session_id = ${sessionId}`;

    // Fetch line items with bundle summary
    const lineItemsRaw = await tx<Omit<OrderLineItemWithSummary, 'bundleItems'>[]>`
      SELECT oli.*, gb.interest, gb.requested_age, gb.party_type, gb.public_id AS bundle_public_id
      FROM order_line_item oli
      JOIN generated_bundle gb ON gb.id = oli.generated_bundle_id
      WHERE oli.customer_order_id = ${order.id}
    `;
    const lineItems: OrderLineItemWithSummary[] = lineItemsRaw.map(li => ({ ...li, bundleItems: [] }));

    return { ...order, lineItems, itemCount: lineItems.reduce((s, li) => s + li.quantity, 0) };
  });

  if (result) {
    // Send confirmation email (outside transaction — failure must not affect response)
    await sendOrderConfirmation({
      publicId: result.public_id,
      customerEmail: result.customer_email,
      customerName: result.customer_name,
      shippingStreet: result.shipping_street,
      shippingCity: result.shipping_city,
      shippingState: result.shipping_state,
      shippingZip: result.shipping_zip,
      shippingCountry: result.shipping_country,
      subtotal: Number(result.subtotal),
      total: Number(result.total),
      lineItems: result.lineItems.map(li => ({
        interest: li.interest,
        upgradeTier: li.upgrade_tier,
        giftBagName: li.gift_bag_name_snapshot,
        quantity: li.quantity,
        unitPrice: Number(li.unit_price),
        lineTotal: Number(li.line_total),
      })),
    });
  }

  return result;
}

// ─── searchOrder ──────────────────────────────────────────────────────────────

/**
 * Public order search by order number + email.
 * Both params required; email match is case-insensitive.
 * Design: specs/payment/design.md §5
 */
export async function searchOrder(
  publicId: string,
  email: string,
): Promise<OrderWithLineItems | null> {
  const orderRows = await sql<CustomerOrderRow[]>`
    SELECT * FROM customer_order
    WHERE public_id = ${publicId}
      AND LOWER(customer_email) = LOWER(${email})
  `;

  if (orderRows.length === 0) return null;
  const order = orderRows[0];

  const lineItemsRaw = await sql<Omit<OrderLineItemWithSummary, 'bundleItems'>[]>`
    SELECT oli.*, gb.interest, gb.requested_age, gb.party_type, gb.public_id AS bundle_public_id
    FROM order_line_item oli
    JOIN generated_bundle gb ON gb.id = oli.generated_bundle_id
    WHERE oli.customer_order_id = ${order.id}
    ORDER BY oli.id ASC
  `;
  const lineItems: OrderLineItemWithSummary[] = lineItemsRaw.map(li => ({ ...li, bundleItems: [] }));

  return { ...order, lineItems, itemCount: lineItems.reduce((s, li) => s + li.quantity, 0) };
}
