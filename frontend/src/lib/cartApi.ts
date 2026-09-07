/**
 * Typed fetch wrappers for the /api/cart endpoints.
 *
 * All cart functions send X-Session-Id instead of Authorization.
 * Session ID is a UUID generated once by CartContext, stored in localStorage.
 * VITE_API_BASE_URL is set at build time.
 *
 * Requirements: R3 (AC3.1–AC3.12), R4 (AC4.1–AC4.7)
 */

const BASE = import.meta.env.VITE_API_BASE_URL as string;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CartItemDto {
  id: number;
  generatedBundleId: string;   // public_id
  interest: string;
  requestedAge: number;
  partyType: string;
  upgradeTier: 'STANDARD' | 'PREMIUM';
  giftBagOptionId: number | null;
  giftBagName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartDto {
  items: CartItemDto[];
  subtotal: number;
  total: number;
  itemCount: number;
}

export interface GiftBagOptionDto {
  id: number;
  code: string;
  name: string;
  description: string | null;
  retailPriceAdjustment: number;
  isDefault: boolean;
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetches the session's cart with computed prices.
 * Requirements: AC3.2, AC3.6, AC4.6
 */
export async function getCart(sessionId: string): Promise<CartDto> {
  const res = await fetch(`${BASE}/api/cart`, {
    headers: { 'X-Session-Id': sessionId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to load cart'), { status: res.status, body: err });
  }
  return res.json() as Promise<CartDto>;
}

/**
 * Adds a bundle to the cart (or updates quantity if already present).
 * Requirements: AC4.1, AC4.2
 */
export async function addToCart(
  sessionId: string,
  body: {
    bundlePublicId: string;
    upgradeTier?: 'STANDARD' | 'PREMIUM';
    giftBagOptionId?: number | null;
    quantity?: number;
  },
): Promise<CartItemDto> {
  const res = await fetch(`${BASE}/api/cart/items`, {
    method: 'POST',
    headers: {
      'X-Session-Id':  sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to add to cart'), { status: res.status, body: err });
  }
  return res.json() as Promise<CartItemDto>;
}

/**
 * Updates an existing cart item's upgrade tier, gift bag, or quantity.
 * Requirements: AC4.3
 */
export async function updateCartItem(
  sessionId: string,
  id: number,
  body: {
    upgradeTier?: 'STANDARD' | 'PREMIUM';
    giftBagOptionId?: number | null;
    quantity?: number;
  },
): Promise<CartItemDto> {
  const res = await fetch(`${BASE}/api/cart/items/${id}`, {
    method: 'PATCH',
    headers: {
      'X-Session-Id':  sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to update cart item'), { status: res.status, body: err });
  }
  return res.json() as Promise<CartItemDto>;
}

/**
 * Removes a single cart item.
 * Requirements: AC4.4
 */
export async function removeCartItem(
  sessionId: string,
  id: number,
): Promise<void> {
  const res = await fetch(`${BASE}/api/cart/items/${id}`, {
    method: 'DELETE',
    headers: { 'X-Session-Id': sessionId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('Failed to remove cart item'), { status: res.status, body: err });
  }
}

/**
 * Clears all items from the cart.
 */
export async function clearCart(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/cart`, {
    method: 'DELETE',
    headers: { 'X-Session-Id': sessionId },
  });
  if (!res.ok) {
    throw new Error('Failed to clear cart');
  }
}

/**
 * Fetches all active gift bag options (no auth required).
 * Requirements: AC3.4
 */
export async function getGiftBagOptions(): Promise<GiftBagOptionDto[]> {
  const res = await fetch(`${BASE}/api/gift-bag-options`);
  if (!res.ok) throw new Error('Failed to load gift bag options');
  return res.json() as Promise<GiftBagOptionDto[]>;
}
