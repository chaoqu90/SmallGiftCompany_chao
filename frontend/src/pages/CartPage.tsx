/**
 * CartPage — shopping cart management.
 *
 * Public route. Fetches cart on mount using session ID (no auth required).
 * Shows each cart item with:
 *   - Bundle summary (interest, age, party type)
 *   - Upgrade tier toggle (STANDARD / PREMIUM)
 *   - Gift bag selector (dropdown of active options + "No gift bag")
 *   - Quantity input (min 1)
 *   - Unit price + line total (from server, never computed in browser)
 *   - Remove button
 *
 * Bottom: subtotal, total, "Proceed to Payment" CTA.
 * Empty state: message + "Generate a Bundle" link.
 *
 * Requirements: R3 (AC3.1–AC3.12), R4 (AC4.1–AC4.7), R9 (AC9.2–AC9.6)
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { useCart } from '../contexts/CartContext'
import {
  getCart,
  updateCartItem,
  removeCartItem,
  getGiftBagOptions,
  type CartDto,
  type CartItemDto,
  type GiftBagOptionDto,
} from '../lib/cartApi'

// ── Currency formatter ─────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ── CartItemCard ──────────────────────────────────────────────────────────────

interface CartItemCardProps {
  item: CartItemDto
  giftBagOptions: GiftBagOptionDto[]
  sessionId: string
  onUpdated: (updated: CartItemDto) => void
  onRemoved: (id: number) => void
}

function CartItemCard({
  item,
  giftBagOptions,
  sessionId,
  onUpdated,
  onRemoved,
}: CartItemCardProps) {
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState(String(item.quantity))

  async function handleUpgradeTierChange(
    _: React.MouseEvent<HTMLElement>,
    newTier: string | null,
  ) {
    if (!newTier || newTier === item.upgradeTier) return
    setError(null)
    setSaving(true)
    try {
      const updated = await updateCartItem(sessionId, item.id, { upgradeTier: newTier as 'STANDARD' | 'PREMIUM' })
      onUpdated(updated)
    } catch {
      setError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleGiftBagChange(newId: number | '' | null) {
    setError(null)
    setSaving(true)
    try {
      const giftBagOptionId = (newId === '' || newId === null) ? null : Number(newId)
      const updated = await updateCartItem(sessionId, item.id, { giftBagOptionId })
      onUpdated(updated)
    } catch {
      setError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleQuantityBlur() {
    const parsed = parseInt(quantityInput, 10)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Quantity must be at least 1.')
      setQuantityInput(String(item.quantity))
      return
    }
    if (parsed === item.quantity) return
    setError(null)
    setSaving(true)
    try {
      const updated = await updateCartItem(sessionId, item.id, { quantity: parsed })
      onUpdated(updated)
    } catch {
      setError('Could not save changes. Please try again.')
      setQuantityInput(String(item.quantity))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setError(null)
    setRemoving(true)
    try {
      await removeCartItem(sessionId, item.id)
      onRemoved(item.id)
    } catch {
      setError('Could not remove item. Please try again.')
      setRemoving(false)
    }
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* Bundle summary (AC3.2) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
              {item.interest.replace(/_/g, ' ')} Bundle
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Age {item.requestedAge} · {item.partyType.replace(/_/g, ' ')}
            </Typography>
          </Box>
          <Tooltip title="Remove item">
            <span>
              <IconButton
                color="default"
                aria-label="Remove item"
                onClick={handleRemove}
                disabled={removing}
                size="small"
              >
                {removing ? <CircularProgress size={18} /> : <DeleteIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Error alert (AC9.5, AC9.6) */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          {/* Upgrade tier toggle (AC3.3) */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Upgrade Tier
            </Typography>
            <ToggleButtonGroup
              value={item.upgradeTier}
              exclusive
              onChange={handleUpgradeTierChange}
              size="small"
              disabled={saving}
            >
              <ToggleButton value="STANDARD">Standard</ToggleButton>
              <ToggleButton value="PREMIUM">Premium</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Gift bag selector (AC3.4) */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Gift Bag</InputLabel>
            <Select
              value={item.giftBagOptionId ?? ''}
              label="Gift Bag"
              onChange={e => handleGiftBagChange(e.target.value as number | '')}
              disabled={saving}
            >
              <MenuItem value="">No gift bag</MenuItem>
              {giftBagOptions.map(opt => (
                <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Quantity input (AC3.5) */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Quantity
            </Typography>
            <TextField
              type="number"
              size="small"
              value={quantityInput}
              onChange={e => setQuantityInput(e.target.value)}
              onBlur={handleQuantityBlur}
              disabled={saving}
              inputProps={{ min: 1, style: { width: 64 } }}
            />
          </Box>
        </Stack>

        {/* Pricing (AC3.6) */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Unit: {fmt.format(item.unitPrice)}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            Total: {fmt.format(item.lineTotal)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── CartPage ──────────────────────────────────────────────────────────────────

export function CartPage() {
  const { sessionId, refreshCart } = useCart()
  const navigate = useNavigate()

  const [cart, setCart] = useState<CartDto | null>(null)
  const [giftBagOptions, setGiftBagOptions] = useState<GiftBagOptionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCart = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const [cartData, bagOptions] = await Promise.all([
        getCart(sessionId),
        getGiftBagOptions(),
      ])
      setCart(cartData)
      setGiftBagOptions(bagOptions)
    } catch {
      setError('Failed to load cart. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  function handleItemUpdated(updated: CartItemDto) {
    setCart(prev => {
      if (!prev) return prev
      const items = prev.items.map(i => i.id === updated.id ? updated : i)
      const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100
      return { ...prev, items, subtotal, total: subtotal, itemCount: items.reduce((s, i) => s + i.quantity, 0) }
    })
    refreshCart()
  }

  function handleItemRemoved(id: number) {
    setCart(prev => {
      if (!prev) return prev
      const items = prev.items.filter(i => i.id !== id)
      const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100
      return { ...prev, items, subtotal, total: subtotal, itemCount: items.reduce((s, i) => s + i.quantity, 0) }
    })
    refreshCart()
  }

  // ── Loading skeleton (AC3.12) ───────────────────────────────────────────────

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>Your Cart</Typography>
        {[1, 2].map(n => (
          <Skeleton key={n} variant="rectangular" height={180} sx={{ mb: 2, borderRadius: 1 }} />
        ))}
        <Skeleton variant="rectangular" height={60} />
      </Container>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" onClick={fetchCart}>Retry</Button>
      </Container>
    )
  }

  // ── Empty state (AC3.11) ────────────────────────────────────────────────────

  if (!cart || cart.items.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <ShoppingCartIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" mb={1}>Your cart is empty</Typography>
        <Typography color="text.secondary" mb={3}>
          Generate a bundle to get started.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Generate a Bundle
        </Button>
      </Container>
    )
  }

  // ── Cart with items ─────────────────────────────────────────────────────────

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Your Cart</Typography>

      {/* Cart item cards */}
      {cart.items.map(item => (
        <CartItemCard
          key={item.id}
          item={item}
          giftBagOptions={giftBagOptions}
          sessionId={sessionId}
          onUpdated={handleItemUpdated}
          onRemoved={handleItemRemoved}
        />
      ))}

      <Divider sx={{ my: 3 }} />

      {/* Order summary (AC3.8) */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Typography color="text.secondary">Subtotal</Typography>
          <Typography fontWeight={600}>{fmt.format(cart.subtotal)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Typography fontWeight={700}>Total</Typography>
          <Typography fontWeight={700} variant="h6">{fmt.format(cart.total)}</Typography>
        </Box>
        <Box sx={{ mt: 1 }}>
          {/* "Proceed to Payment" button (AC3.9, AC3.10) */}
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/checkout')}
            disabled={cart.items.length === 0}
          >
            Proceed to Payment
          </Button>
        </Box>
      </Box>
    </Container>
  )
}
