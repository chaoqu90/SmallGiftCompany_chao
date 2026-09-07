/**
 * OrdersPage — authenticated user's order history.
 *
 * Protected route. Fetches paginated orders (newest first).
 * Each row shows: public_id, status chip, total, item count, date.
 * Clicking a row navigates to /orders/:publicId.
 *
 * Requirements: R6 (AC6.5–AC6.8), R7 (AC7.1)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { listOrders, type OrderListItemDto } from '../lib/ordersApi'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ── Status chip color mapping (AC6.2) ─────────────────────────────────────────

type ChipColor = 'default' | 'info' | 'warning' | 'success' | 'error'

const STATUS_COLORS: Record<string, ChipColor> = {
  PENDING:   'default',
  CONFIRMED: 'info',
  FULFILLED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  REFUNDED:  'default',
}

function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      label={status}
      color={STATUS_COLORS[status] ?? 'default'}
      size="small"
    />
  )
}

// ── OrdersPage ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function OrdersPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [orders, setOrders]   = useState<OrderListItemDto[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const accessToken = session?.access_token ?? ''

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    listOrders(accessToken, page, PAGE_SIZE)
      .then(result => {
        setOrders(result.orders)
        setTotal(result.total)
      })
      .catch(() => setError('Failed to load orders. Please try again.'))
      .finally(() => setLoading(false))
  }, [accessToken, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    )
  }

  // ── Empty state (AC6.7) ─────────────────────────────────────────────────────

  if (orders.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h6" mb={1}>You have not placed any orders yet</Typography>
        <Typography color="text.secondary" mb={3}>
          Generate a bundle and place your first order.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Generate a Bundle
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>My Orders</Typography>

      {/* Orders table (AC6.6) */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map(order => (
              <TableRow
                key={order.publicId}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/orders/${order.publicId}`)}
              >
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {order.publicId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip status={order.status} />
                </TableCell>
                <TableCell align="right">{fmt.format(order.total)}</TableCell>
                <TableCell align="right">{order.itemCount}</TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                  }).format(new Date(order.createdAt))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination (AC6.8) */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Container>
  )
}
