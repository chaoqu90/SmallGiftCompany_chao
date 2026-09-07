/**
 * OrderDetailPage — single order view with line items.
 *
 * Public route at /orders/:publicId.
 * No auth required — publicId is the access key (12-char hex, unguessable).
 * Shared by the post-checkout confirmation (shows success alert) and
 * direct access from the orders list.
 *
 * Requirements: R6 (AC6.1–AC6.4, AC6.9–AC6.10)
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation, Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  Container,
  Divider,
  Link,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { getOrder, type OrderDto } from '../lib/ordersApi'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

type ChipColor = 'default' | 'info' | 'warning' | 'success' | 'error'

const STATUS_COLORS: Record<string, ChipColor> = {
  PENDING:   'default',
  CONFIRMED: 'info',
  FULFILLED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  REFUNDED:  'default',
}

interface LocationState {
  fromCheckout?: boolean
}

export function OrderDetailPage() {
  const { publicId } = useParams<{ publicId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState) ?? {}

  const [order, setOrder]   = useState<OrderDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!publicId) return
    setLoading(true)
    getOrder(publicId)
      .then(setOrder)
      .catch((err: { status?: number }) => {
        if (err.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [publicId])

  // ── Loading (AC6.9) ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={200} />
      </Container>
    )
  }

  // ── Not found (AC6.10) ──────────────────────────────────────────────────────

  if (notFound || !order) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h6" mb={2}>Order not found</Typography>
        <Link component={RouterLink} to="/" onClick={() => navigate('/')}>Back to Home</Link>
      </Container>
    )
  }

  // ── Order detail ────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Success alert shown only immediately after checkout (AC6.4) */}
      {state.fromCheckout && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Your order has been placed. We will prepare your shipment.
        </Alert>
      )}

      {/* Order header (AC6.2) */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Order ID</Typography>
            <Typography variant="h6" fontFamily="monospace">{order.publicId}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Box mt={0.5}>
              <Chip
                label={order.status}
                color={STATUS_COLORS[order.status] ?? 'default'}
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Date</Typography>
            <Typography>
              {new Intl.DateTimeFormat(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              }).format(new Date(order.createdAt))}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography fontWeight={700}>{fmt.format(order.total)}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Line items table (AC6.3) */}
      <Typography variant="h6" fontWeight={700} mb={2}>Items</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bundle</TableCell>
              <TableCell>Tier</TableCell>
              <TableCell>Gift Bag</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Line Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.lineItems.map(li => (
              <TableRow key={li.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                    {li.interest.replace(/_/g, ' ')} Bundle
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Age {li.requestedAge} · {li.partyType.replace(/_/g, ' ')}
                  </Typography>
                </TableCell>
                <TableCell>{li.upgradeTier}</TableCell>
                <TableCell>{li.giftBagName ?? 'No gift bag'}</TableCell>
                <TableCell align="right">{li.quantity}</TableCell>
                <TableCell align="right">{fmt.format(li.unitPrice)}</TableCell>
                <TableCell align="right">{fmt.format(li.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Total summary */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Typography fontWeight={700}>Order Total</Typography>
          <Typography fontWeight={700}>{fmt.format(order.total)}</Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Link component={RouterLink} to="/">Back to Home</Link>
    </Container>
  )
}
