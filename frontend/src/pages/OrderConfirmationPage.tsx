/**
 * OrderConfirmationPage — shown after Stripe redirects back post-payment.
 *
 * Stripe appends ?payment_intent=pi_xxx&redirect_status=succeeded to the URL.
 * This page reads redirect_status and shows either a success or failure message.
 *
 * The DB order is created asynchronously by the Stripe webhook. The confirmation
 * email contains the order number. Users can look up their order via /orders/search.
 *
 * Public route (no auth required).
 * Design: specs/payment/design.md §4.4
 */
import { useEffect } from 'react'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useCart } from '../contexts/CartContext'

export function OrderConfirmationPage() {
  const [searchParams] = useSearchParams()
  const redirectStatus = searchParams.get('redirect_status')
  const succeeded = redirectStatus === 'succeeded'
  const { setCartCount } = useCart()

  // Clear cart badge immediately on successful payment
  useEffect(() => {
    if (succeeded) {
      setCartCount(0)
    }
  }, [succeeded, setCartCount])

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack alignItems="center" spacing={3} textAlign="center">
        {succeeded ? (
          <>
            <CheckCircleOutlineIcon sx={{ fontSize: 72, color: 'success.main' }} />
            <Typography variant="h5" fontWeight={700}>
              Payment Successful!
            </Typography>
            <Typography color="text.secondary">
              Your order has been received. We're preparing your goodie bags!
            </Typography>
            <Alert severity="info" sx={{ width: '100%', textAlign: 'left' }}>
              <strong>Check your email</strong> for your order confirmation. It contains your
              order number, which you can use to look up your order status at any time.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width="100%">
              <Button
                component={RouterLink}
                to="/orders/search"
                variant="contained"
                fullWidth
              >
                Find My Order
              </Button>
              <Button
                component={RouterLink}
                to="/"
                variant="outlined"
                fullWidth
              >
                Back to Home
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 72, color: 'error.main' }} />
            <Typography variant="h5" fontWeight={700}>
              Payment Not Completed
            </Typography>
            <Typography color="text.secondary">
              Your payment was not processed. Your cart has been preserved — please try again.
            </Typography>
            {redirectStatus && redirectStatus !== 'succeeded' && (
              <Alert severity="warning" sx={{ width: '100%', textAlign: 'left' }}>
                Status: {redirectStatus}
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width="100%">
              <Button
                component={RouterLink}
                to="/checkout"
                variant="contained"
                fullWidth
              >
                Try Again
              </Button>
              <Button
                component={RouterLink}
                to="/cart"
                variant="outlined"
                fullWidth
              >
                Back to Cart
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  )
}
