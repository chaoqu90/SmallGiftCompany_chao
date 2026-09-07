/**
 * CheckoutPage — Stripe payment checkout.
 *
 * Two-phase UI:
 *   Phase 1: Contact + shipping address form + "Continue to Payment" button
 *            → calls POST /api/checkout/intent → returns clientSecret
 *   Phase 2: Stripe Payment Element renders (credit card + Apple Pay)
 *            → stripe.confirmPayment() → redirects to /orders/confirmation
 *
 * Cart items come from CartContext (localStorage-backed, no server fetch).
 * Items are sent in the createPaymentIntent request body so the backend
 * can write them to the DB at checkout time.
 *
 * No auth required. Email is required (pre-filled if signed in).
 * Shipping address is required.
 *
 * Design: specs/payment/design.md §4.2
 * Requirements: R5 (AC5.1–AC5.9)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { getGiftBagOptions, type GiftBagOptionDto } from '../lib/cartApi'
import { createPaymentIntent } from '../lib/ordersApi'
import { getProfile } from '../lib/userApi'

// ─── Stripe initialisation ────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Local price computation (mirrors CartPage formula) ───────────────────────

function computeUnitPrice(
  bundle: { bundleRetailPrice: number | null; upgrade: { standardRetailAdjustment: number | null; upgradedRetailAdjustment: number | null } | null },
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

// ─── Inner payment form (rendered inside <Elements>) ─────────────────────────

interface PaymentFormProps {
  totalCents: number
  onBack: () => void
}

function PaymentForm({ totalCents, onBack }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true)
    setPayError(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders/confirmation`,
      },
    })

    // Only reaches here if there's an immediate error (card declined, etc.)
    if (error) {
      setPayError(error.message ?? 'Payment failed. Please try again.')
      setPaying(false)
    }
  }

  return (
    <Box component="form" onSubmit={handlePay}>
      <Typography variant="h6" fontWeight={700} mb={2}>
        Payment — {fmt.format(totalCents / 100)}
      </Typography>

      <PaymentElement />

      {payError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {payError}
        </Alert>
      )}

      <Stack direction="row" spacing={2} mt={3}>
        <Button variant="outlined" onClick={onBack} disabled={paying}>
          Back
        </Button>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!stripe || !elements || paying}
          startIcon={paying ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ flex: 1 }}
        >
          {paying ? 'Processing…' : `Pay ${fmt.format(totalCents / 100)}`}
        </Button>
      </Stack>
    </Box>
  )
}

// ─── Main CheckoutPage ────────────────────────────────────────────────────────

export function CheckoutPage() {
  const { session } = useAuth()
  const { sessionId, items } = useCart()
  const navigate = useNavigate()

  const [giftBagOptions, setGiftBagOptions] = useState<GiftBagOptionDto[]>([])

  // Contact + shipping fields
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [shippingStreet, setShippingStreet] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingZip, setShippingZip] = useState('')

  // Phase 2 state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [totalCents, setTotalCents] = useState(0)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  // Pre-populate contact fields from auth session and profile
  useEffect(() => {
    const accessToken = session?.access_token
    if (session?.user?.email) setEmail(session.user.email)
    if (accessToken) {
      getProfile(accessToken).then(profile => {
        if (profile?.displayName) setFullName(profile.displayName)
      }).catch(() => { /* ignore */ })
    }
  }, [session])

  // Fetch gift bag options for the order summary display
  useEffect(() => {
    getGiftBagOptions().then(setGiftBagOptions).catch(() => { /* non-critical */ })
  }, [])

  // Compute local total for the order summary
  const localTotal = items.reduce((sum, item) => {
    const selectedGiftBag = item.giftBagOptionId != null
      ? (giftBagOptions.find(o => o.id === item.giftBagOptionId) ?? null)
      : null
    const unitPrice = computeUnitPrice(item.bundle, item.upgradeTier, selectedGiftBag)
    return Math.round((sum + unitPrice * item.quantity) * 100) / 100
  }, 0)

  const hasItems = items.length > 0
  const canContinue =
    !creatingIntent &&
    hasItems &&
    email.trim().length > 0 &&
    email.includes('@') &&
    shippingStreet.trim() &&
    shippingCity.trim() &&
    shippingState.trim() &&
    shippingZip.trim()

  async function handleContinueToPayment() {
    if (!canContinue) return
    setIntentError(null)
    setCreatingIntent(true)
    try {
      const result = await createPaymentIntent(
        sessionId,
        {
          email: email.trim(),
          name: fullName.trim() || undefined,
          shippingStreet: shippingStreet.trim(),
          shippingCity: shippingCity.trim(),
          shippingState: shippingState.trim(),
          shippingZip: shippingZip.trim(),
          shippingCountry: 'US',
          items: items.map(item => ({
            bundlePublicId: item.bundle.generatedBundleId,
            upgradeTier: item.upgradeTier,
            giftBagOptionId: item.giftBagOptionId,
            quantity: item.quantity,
          })),
        },
        session?.access_token,
      )
      setClientSecret(result.clientSecret)
      setTotalCents(result.totalCents)
    } catch {
      setIntentError('Failed to initialise payment. Please try again.')
    } finally {
      setCreatingIntent(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Checkout</Typography>

      {/* Order summary */}
      {hasItems ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Order Summary</Typography>
          <Stack spacing={1.5} divider={<Divider />}>
            {items.map(item => {
              const selectedGiftBag = item.giftBagOptionId != null
                ? (giftBagOptions.find(o => o.id === item.giftBagOptionId) ?? null)
                : null
              const unitPrice = computeUnitPrice(item.bundle, item.upgradeTier, selectedGiftBag)
              const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100
              const bundleLabel = item.bundle.templateCode
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/\b\w/g, c => c.toUpperCase())
              return (
                <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {bundleLabel}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.upgradeTier} · {selectedGiftBag?.name ?? 'No gift bag'} · Qty {item.quantity}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={600}>
                    {fmt.format(lineTotal)}
                  </Typography>
                </Box>
              )
            })}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={700}>{fmt.format(localTotal)}</Typography>
          </Box>
        </Paper>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your cart is empty.{' '}
          <Link component="button" onClick={() => navigate('/cart')} underline="always">
            Go back to cart
          </Link>
        </Alert>
      )}

      {/* Phase 1: Contact + shipping form */}
      {!clientSecret && (
        <>
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Contact Details</Typography>
            <Stack spacing={2}>
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                helperText="We'll send your order confirmation here."
              />
              <TextField
                label="Full Name (optional)"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                fullWidth
                autoComplete="name"
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Shipping Address</Typography>
            <Stack spacing={2}>
              <TextField
                label="Street Address"
                value={shippingStreet}
                onChange={e => setShippingStreet(e.target.value)}
                required
                fullWidth
                autoComplete="street-address"
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="City"
                  value={shippingCity}
                  onChange={e => setShippingCity(e.target.value)}
                  required
                  fullWidth
                  autoComplete="address-level2"
                />
                <TextField
                  label="State"
                  value={shippingState}
                  onChange={e => setShippingState(e.target.value)}
                  required
                  sx={{ minWidth: 120 }}
                  autoComplete="address-level1"
                />
                <TextField
                  label="ZIP Code"
                  value={shippingZip}
                  onChange={e => setShippingZip(e.target.value)}
                  required
                  sx={{ minWidth: 120 }}
                  autoComplete="postal-code"
                />
              </Stack>
            </Stack>
          </Paper>

          {intentError && (
            <Alert severity="error" sx={{ mb: 2 }}>{intentError}</Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleContinueToPayment}
              disabled={!canContinue}
              startIcon={creatingIntent ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {creatingIntent ? 'Loading…' : 'Continue to Payment'}
            </Button>
          </Box>
        </>
      )}

      {/* Phase 2: Stripe Payment Element */}
      {clientSecret && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <PaymentForm
              totalCents={totalCents}
              onBack={() => setClientSecret(null)}
            />
          </Elements>
        </Paper>
      )}
    </Container>
  )
}
