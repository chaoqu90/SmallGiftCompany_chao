/**
 * OrderSearchPage — public order lookup by order number + email.
 *
 * Any user can find their order using the order number (from the confirmation email)
 * and the email address they provided at checkout.
 *
 * Public route (no auth required).
 * Design: specs/payment/design.md §5
 */
import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { searchOrder, type OrderDto } from '../lib/ordersApi'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  PENDING:    'warning',
  CONFIRMED:  'info',
  FULFILLED:  'success',
  COMPLETED:  'success',
  CANCELLED:  'error',
  REFUNDED:   'default',
}

export function OrderSearchPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [order, setOrder]             = useState<OrderDto | null>(null)
  const [notFound, setNotFound]       = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const canSearch = orderNumber.trim() && email.trim().includes('@') && !loading

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!canSearch) return
    setLoading(true)
    setNotFound(false)
    setSearchError(null)
    setOrder(null)

    try {
      const result = await searchOrder(orderNumber.trim(), email.trim())
      if (result) {
        setOrder(result)
      } else {
        setNotFound(true)
      }
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Find My Order
      </Typography>
      <Typography color="text.secondary" mb={3}>
        Enter your order number (from your confirmation email) and the email address
        you used at checkout.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box component="form" onSubmit={handleSearch}>
          <Stack spacing={2}>
            <TextField
              label="Order Number"
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              placeholder="ord_xxxxxxxxxxxx"
              required
              fullWidth
            />
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={!canSearch}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
            >
              {loading ? 'Searching…' : 'Find Order'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {searchError && (
        <Alert severity="error" sx={{ mb: 3 }}>{searchError}</Alert>
      )}

      {notFound && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No order found matching that order number and email address.
          Please check and try again.
        </Alert>
      )}

      {order && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>
              Order #{order.publicId}
            </Typography>
            <Chip
              label={order.status}
              color={STATUS_COLORS[order.status] ?? 'default'}
              size="small"
            />
          </Stack>

          <Typography variant="body2" color="text.secondary" mb={2}>
            Placed {new Date(order.createdAt).toLocaleDateString()}
          </Typography>

          <Stack spacing={1.5} divider={<Divider />}>
            {order.lineItems.map(li => (
              <Box key={li.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                    {li.interest.replace(/_/g, ' ')} Bundle
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {li.upgradeTier} · {li.giftBagName ?? 'No gift bag'} · Qty {li.quantity}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {fmt.format(li.lineTotal)}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={700}>{fmt.format(order.total)}</Typography>
          </Box>
        </Paper>
      )}
    </Container>
  )
}
