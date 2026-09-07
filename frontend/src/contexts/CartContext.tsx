/**
 * CartContext — fully local cart backed by localStorage.
 *
 * Cart items are never written to the DB during browsing.
 * DB writes happen only when the user clicks "Continue to Payment"
 * (via createPaymentIntent in ordersApi.ts which receives items in its body).
 *
 * On mount: reads or creates a UUID in localStorage ('cart_session_id').
 * Items are read/written as JSON to localStorage ('cart_items').
 *
 * refreshCart and setCartCount are no-ops kept for interface compatibility
 * with existing callers.
 *
 * Requirements: AC2.4, AC2.5, AC4.5, AC4.6
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { GeneratedBundleResponse } from '../types/catalog'

export interface LocalCartItem {
  id: string                        // client-generated UUID (crypto.randomUUID())
  bundle: GeneratedBundleResponse   // full bundle snapshot from sessionStorage
  upgradeTier: 'STANDARD' | 'PREMIUM'
  giftBagOptionId: number | null    // null = no gift bag
  quantity: number
}

interface CartContextValue {
  sessionId: string
  items: LocalCartItem[]
  cartCount: number                 // total quantity across all items
  addItem: (
    bundle: GeneratedBundleResponse,
    upgradeTier?: 'STANDARD' | 'PREMIUM',
    giftBagOptionId?: number | null,
    quantity?: number,
  ) => void
  updateItem: (id: string, patch: Partial<Pick<LocalCartItem, 'upgradeTier' | 'giftBagOptionId' | 'quantity'>>) => void
  removeItem: (id: string) => void
  clearCart: () => void
  refreshCart: () => Promise<void>  // no-op (kept for interface compat with existing callers)
  setCartCount: (n: number) => void // no-op (kept for compat)
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY_SESSION = 'cart_session_id'
const STORAGE_KEY_ITEMS = 'cart_items'

function readItemsFromStorage(): LocalCartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS)
    if (!raw) return []
    return JSON.parse(raw) as LocalCartItem[]
  } catch {
    return []
  }
}

function writeItemsToStorage(items: LocalCartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items))
  } catch {
    // Storage quota exceeded or private-browsing restriction — silently ignore
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState('')
  const [items, setItems] = useState<LocalCartItem[]>([])

  // Initialise session ID and cart items from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_SESSION)
    const id = stored ?? crypto.randomUUID()
    if (!stored) localStorage.setItem(STORAGE_KEY_SESSION, id)
    setSessionId(id)
    setItems(readItemsFromStorage())
  }, [])

  // Persist items to localStorage whenever they change
  useEffect(() => {
    writeItemsToStorage(items)
  }, [items])

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const addItem = useCallback((
    bundle: GeneratedBundleResponse,
    upgradeTier: 'STANDARD' | 'PREMIUM' = 'STANDARD',
    giftBagOptionId: number | null = null,
    quantity: number = 1,
  ) => {
    setItems(prev => {
      const existing = prev.find(i => i.bundle.generatedBundleId === bundle.generatedBundleId)
      if (existing) {
        // Same bundle already in cart — increment quantity
        return prev.map(i =>
          i.bundle.generatedBundleId === bundle.generatedBundleId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        )
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          bundle,
          upgradeTier,
          giftBagOptionId,
          quantity,
        },
      ]
    })
  }, [])

  const updateItem = useCallback((
    id: string,
    patch: Partial<Pick<LocalCartItem, 'upgradeTier' | 'giftBagOptionId' | 'quantity'>>,
  ) => {
    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, ...patch } : i),
    )
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  // No-ops kept for interface compatibility
  const refreshCart = useCallback(async () => {
    // Local cart — nothing to refresh from server
  }, [])

  const setCartCount = useCallback((_n: number) => {
    // No-op — cartCount is derived from items
  }, [])

  return (
    <CartContext.Provider
      value={{
        sessionId,
        items,
        cartCount,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        refreshCart,
        setCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within <CartProvider>')
  return ctx
}
