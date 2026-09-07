/**
 * CheckoutPage — Stripe payment checkout.
 *
 * Two-phase UI:
 *   Phase 1: Contact + shipping address form + "Continue to Payment" button
 *            → calls POST /api/checkout/intent → returns clientSecret
 *   Phase 2: Stripe Payment Element renders (credit card + Apple Pay)
 *            → stripe.confirmPayment() → redirects to /orders/confirmation
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
  Skeleton,
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
import { getCart, type CartDto } from '../lib/cartApi'
import { createPaymentIntent } from '../lib/ordersApi'
import { getProfile } from '../lib/userApi'

// ─── Stripe initialisation ────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

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
  const { sessionId } = useCart()
  const navigate = useNavigate()

  const [cart, setCart] = useState<CartDto | null>(null)
  const [loadingCart, setLoadingCart] = useState(true)
  const [cartError, setCartError] = useState<string | null>(null)

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

  // Fetch cart and pre-populate contact fields
  useEffect(() => {
    if (!sessionId) return
    const accessToken = session?.access_token

    Promise.all([
      getCart(sessionId),
      accessToken ? getProfile(accessToken).catch(() => null) : Promise.resolve(null),
    ])
      .then(([cartData, profile]) => {
        setCart(cartData)
        if (session?.user?.email) setEmail(session.user.email)
        if (profile?.displayName) setFullName(profile.displayName)
      })
      .catch(() => setCartError('Failed to load cart. Please try again.'))
      .finally(() => setLoadingCart(false))
  }, [sessionId, session])

  const hasItems = (cart?.items.length ?? 0) > 0
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

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loadingCart) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={180} />
      </Container>
    )
  }

  if (cartError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{cartError}</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Checkout</Typography>

      {/* Order summary */}
      {hasItems ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Order Summary</Typography>
          <Stack spacing={1.5} divider={<Divider />}>
            {cart!.items.map(item => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                    {item.interest.replace(/_/g, ' ')} Bundle
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.upgradeTier} · {item.giftBagName ?? 'No gift bag'} · Qty {item.quantity}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {fmt.format(item.lineTotal)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={700}>{fmt.format(cart!.total)}</Typography>
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
