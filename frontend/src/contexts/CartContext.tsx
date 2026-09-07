/**
 * CartContext — session ID management and global cart item count for the NavBar badge.
 *
 * On mount: reads or creates a UUID in localStorage ('cart_session_id').
 * Fetches the cart using X-Session-Id header (no auth required).
 * Exposes `sessionId`, `cartCount`, `refreshCart()`, and `setCartCount()`.
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
import { getCart } from '../lib/cartApi'

interface CartContextValue {
  sessionId: string
  cartCount: number
  refreshCart: () => Promise<void>
  setCartCount: (count: number) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState('')
  const [cartCount, setCartCount] = useState(0)

  // Initialise session ID from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cart_session_id')
    const id = stored ?? crypto.randomUUID()
    if (!stored) localStorage.setItem('cart_session_id', id)
    setSessionId(id)
  }, [])

  const refreshCart = useCallback(async () => {
    if (!sessionId) return
    try {
      const cart = await getCart(sessionId)
      setCartCount(cart.itemCount)
    } catch {
      // Silently ignore — badge goes stale but app remains functional
    }
  }, [sessionId])

  // Fetch cart count once when sessionId is ready
  useEffect(() => {
    if (sessionId) {
      refreshCart()
    }
  }, [sessionId, refreshCart])

  return (
    <CartContext.Provider value={{ sessionId, cartCount, refreshCart, setCartCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within <CartProvider>')
  return ctx
}
