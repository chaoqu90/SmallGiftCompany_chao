/**
 * CartPage — shopping cart management (local-state version).
 *
 * Public route. Reads cart items from CartContext (localStorage-backed).
 * Shows each cart item with:
 *   - Bundle summary (template code)
 *   - Upgrade tier toggle (STANDARD / PREMIUM)
 *   - Gift bag selector (dropdown of active options + "No gift bag")
 *   - Quantity input (min 1)
 *   - Unit price + line total (computed locally from pricing formula)
 *   - Remove button
 *
 * Bottom: subtotal, "Proceed to Payment" CTA.
 * Empty state: message + "Generate a Bundle" link.
 *
 * Gift bag options are still fetched from backend (needed for dropdown).
 *
 * Requirements: R3 (AC3.1–AC3.12), R4 (AC4.1–AC4.7), R9 (AC9.2–AC9.6)
 */
import { useEffect, useState } from 'react'
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
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { useCart, type LocalCartItem } from '../contexts/CartContext'
import {
  getGiftBagOptions,
  type GiftBagOptionDto,
} from '../lib/cartApi'
import type { GeneratedBundleResponse } from '../types/catalog'

// ── Currency formatter ─────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ── Price helper ───────────────────────────────────────────────────────────────

function computeUnitPrice(
  bundle: GeneratedBundleResponse,
  upgradeTier: 'STANDARD' | 'PREMIUM',
  selectedGiftBag: GiftBagOptionDto | null,
): number {
  const base = bundle.bundleRetailPrice ?? 0
  const upgradeAdj = upgradeTier === 'PREMIUM'
    ? (bundle.upgrade?.upgradedRetailAdjustment ?? 0)
    : (bundle.upgrade?.standardRetailAdjustment ?? 0)
  const giftBagAdj = selectedGiftBag?.retailPriceAdjustment ?? 0
  return Math.round((base + upgradeAdj + giftBagAdj) * 100) / 100
}

// ── CartItemCard ──────────────────────────────────────────────────────────────

interface CartItemCardProps {
  item: LocalCartItem
  giftBagOptions: GiftBagOptionDto[]
  onUpdated: (id: string, patch: Partial<Pick<LocalCartItem, 'upgradeTier' | 'giftBagOptionId' | 'quantity'>>) => void
  onRemoved: (id: string) => void
}

function CartItemCard({
  item,
  giftBagOptions,
  onUpdated,
  onRemoved,
}: CartItemCardProps) {
  const [removing, setRemoving] = useState(false)
  const [quantityInput, setQuantityInput] = useState(String(item.quantity))
  const [quantityError, setQuantityError] = useState<string | null>(null)

  const selectedGiftBag = item.giftBagOptionId != null
    ? (giftBagOptions.find(o => o.id === item.giftBagOptionId) ?? null)
    : null

  const unitPrice = computeUnitPrice(item.bundle, item.upgradeTier, selectedGiftBag)
  const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100

  function handleUpgradeTierChange(
    _: React.MouseEvent<HTMLElement>,
    newTier: string | null,
  ) {
    if (!newTier || newTier === item.upgradeTier) return
    onUpdated(item.id, { upgradeTier: newTier as 'STANDARD' | 'PREMIUM' })
  }

  function handleGiftBagChange(newId: number | '' | null) {
    const giftBagOptionId = (newId === '' || newId === null) ? null : Number(newId)
    onUpdated(item.id, { giftBagOptionId })
  }

  function handleQuantityBlur() {
    const parsed = parseInt(quantityInput, 10)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setQuantityError('Quantity must be at least 1.')
      setQuantityInput(String(item.quantity))
      return
    }
    setQuantityError(null)
    if (parsed !== item.quantity) {
      onUpdated(item.id, { quantity: parsed })
    }
  }

  function handleRemove() {
    setRemoving(true)
    onRemoved(item.id)
  }

  // Derive a readable bundle label from templateCode
  const bundleLabel = item.bundle.templateCode
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* Bundle summary */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {bundleLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bundle ID: {item.bundle.generatedBundleId.slice(0, 8)}…
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

        {/* Quantity error alert */}
        {quantityError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setQuantityError(null)}>
            {quantityError}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          {/* Upgrade tier toggle */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Upgrade Tier
            </Typography>
            <ToggleButtonGroup
              value={item.upgradeTier}
              exclusive
              onChange={handleUpgradeTierChange}
              size="small"
            >
              <ToggleButton value="STANDARD">Standard</ToggleButton>
              <ToggleButton value="PREMIUM">Premium</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Gift bag selector */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Gift Bag</InputLabel>
            <Select
              value={item.giftBagOptionId ?? ''}
              label="Gift Bag"
              onChange={e => handleGiftBagChange(e.target.value as number | '')}
            >
              <MenuItem value="">No gift bag</MenuItem>
              {giftBagOptions.map(opt => (
                <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Quantity input */}
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
              inputProps={{ min: 1, style: { width: 64 } }}
            />
          </Box>
        </Stack>

        {/* Pricing */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Unit: {fmt.format(unitPrice)}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            Total: {fmt.format(lineTotal)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── CartPage ──────────────────────────────────────────────────────────────────

export function CartPage() {
  const { items, updateItem, removeItem } = useCart()
  const navigate = useNavigate()

  const [giftBagOptions, setGiftBagOptions] = useState<GiftBagOptionDto[]>([])
  const [giftBagError, setGiftBagError] = useState<string | null>(null)

  // Fetch gift bag options from backend (still needed for the dropdown)
  useEffect(() => {
    getGiftBagOptions()
      .then(setGiftBagOptions)
      .catch(() => setGiftBagError('Could not load gift bag options.'))
  }, [])

  // Compute subtotal from local items
  const subtotal = items.reduce((sum, item) => {
    const selectedGiftBag = item.giftBagOptionId != null
      ? (giftBagOptions.find(o => o.id === item.giftBagOptionId) ?? null)
      : null
    const unitPrice = computeUnitPrice(item.bundle, item.upgradeTier, selectedGiftBag)
    return Math.round((sum + unitPrice * item.quantity) * 100) / 100
  }, 0)

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (items.length === 0) {
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

      {giftBagError && (
        <Alert severity="warning" sx={{ mb: 2 }}>{giftBagError}</Alert>
      )}

      {/* Cart item cards */}
      {items.map(item => (
        <CartItemCard
          key={item.id}
          item={item}
          giftBagOptions={giftBagOptions}
          onUpdated={updateItem}
          onRemoved={removeItem}
        />
      ))}

      <Divider sx={{ my: 3 }} />

      {/* Order summary */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Typography color="text.secondary">Subtotal</Typography>
          <Typography fontWeight={600}>{fmt.format(subtotal)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Typography fontWeight={700}>Total</Typography>
          <Typography fontWeight={700} variant="h6">{fmt.format(subtotal)}</Typography>
        </Box>
        <Box sx={{ mt: 1 }}>
          {/* "Proceed to Payment" button */}
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/checkout')}
            disabled={items.length === 0}
          >
            Proceed to Payment
          </Button>
        </Box>
      </Box>
    </Container>
  )
}
