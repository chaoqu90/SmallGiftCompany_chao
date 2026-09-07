/**
 * Typed fetch wrappers for the /api/orders and /api/checkout endpoints.
 *
 * createPaymentIntent — POST /api/checkout/intent; creates Stripe PI, returns clientSecret.
 * createOrder         — POST /api/orders; legacy/fallback order creation.
 * listOrders          — GET /api/orders; JWT required (login-only).
 * getOrder            — GET /api/orders/:publicId; no auth.
 * searchOrder         — GET /api/orders/search?orderNumber=&email=; no auth.
 *
 * VITE_API_BASE_URL is set at build time.
 *
 * Requirements: R5 (AC5.6), R6 (AC6.1–AC6.10); Design: specs/payment/design.md
 */

const BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface OrderLineItemDto {
  id: number;
  bundlePublicId: string;
  interest: string;
  requestedAge: number;
  partyType: string;
  upgradeTier: string;
  giftBagName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderDto {
  publicId: string;
  status: string;
  subtotal: number;
  total: number;
  currency: string;
  customerEmail: string;
  customerName: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lineItems: OrderLineItemDto[];
}

export interface OrderListItemDto {
  publicId: string;
  status: string;
  total: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

export interface PaginatedOrdersDto {
  orders: OrderListItemDto[];
  total: number;
  page: number;
  limit: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Creates an order from the session's current cart.
 * Requires X-Session-Id header and { email, name? } body.
 * No Authorization header needed — auth is optional (JWT sent separately if available).
 * Requirements: AC5.6
 */
export async function createOrder(
  sessionId: string,
  email: string,
  name?: string,
  accessToken?: string,
): Promise<OrderDto> {
  const headers: Record<string, string> = {
    'X-Session-Id': sessionId,
    'Content-Type': 'application/json',
  };
  // Forward JWT if the user is signed in (stores userId on order for order history)
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to create order'), { status: res.status, body: err });
  }
  return res.json() as Promise<OrderDto>;
}

/**
 * Lists the authenticated user's orders (paginated, newest first).
 * Requires a valid JWT — this endpoint remains login-only.
 * Requirements: AC6.6, AC6.8
 */
export async function listOrders(
  accessToken: string,
  page = 1,
  limit = 20,
): Promise<PaginatedOrdersDto> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${BASE}/api/orders?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json() as Promise<PaginatedOrdersDto>;
}

/**
 * Fetches a single order with full line item detail.
 * No auth required — publicId is unguessable (12-char hex).
 * Requirements: AC6.2, AC6.3
 */
export async function getOrder(
  publicId: string,
): Promise<OrderDto> {
  const res = await fetch(`${BASE}/api/orders/${publicId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to load order'), { status: res.status, body: err });
  }
  return res.json() as Promise<OrderDto>;
}

// ─── Payment API ──────────────────────────────────────────────────────────────

export interface PaymentIntentResult {
  clientSecret: string;
  totalCents: number;
}

export interface CheckoutIntentBody {
  email: string;
  name?: string;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry?: string;
}

/**
 * Creates a Stripe PaymentIntent for the session's current cart.
 * Returns the clientSecret needed to render the Stripe Payment Element.
 * Design: specs/payment/design.md §4.1
 */
export async function createPaymentIntent(
  sessionId: string,
  body: CheckoutIntentBody,
  accessToken?: string,
): Promise<PaymentIntentResult> {
  const headers: Record<string, string> = {
    'X-Session-Id': sessionId,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${BASE}/api/checkout/intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to create payment intent'), { status: res.status, body: err });
  }
  return res.json() as Promise<PaymentIntentResult>;
}

/**
 * Searches for an order by order number + email (case-insensitive).
 * No auth required — both params together prove ownership.
 * Design: specs/payment/design.md §5
 */
export async function searchOrder(
  orderNumber: string,
  email: string,
): Promise<OrderDto | null> {
  const params = new URLSearchParams({ orderNumber, email });
  const res = await fetch(`${BASE}/api/orders/search?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to search order');
  return res.json() as Promise<OrderDto>;
}
