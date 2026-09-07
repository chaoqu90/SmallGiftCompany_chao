/**
 * AdminOrdersPage — admin order list with status filter and pagination.
 *
 * Part of the admin panel (Basic auth, /admin/* routes).
 * Fetches from GET /admin/api/orders with status and page filters.
 * Row click navigates to /admin/orders/:publicId.
 *
 * Requirements: R8 (AC8.1–AC8.5)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'

const BASE = import.meta.env.VITE_API_BASE_URL as string

const STATUSES = ['PENDING', 'CONFIRMED', 'FULFILLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const
type Status = typeof STATUSES[number]

type ChipColor = 'default' | 'info' | 'warning' | 'success' | 'error'
const STATUS_COLORS: Record<string, ChipColor> = {
  PENDING: 'default', CONFIRMED: 'info', FULFILLED: 'warning',
  COMPLETED: 'success', CANCELLED: 'error', REFUNDED: 'default',
}

interface AdminOrderRow {
  publicId: string
  customerEmail: string
  status: string
  total: number
  currency: string
  itemCount: number
  createdAt: string
}

interface OrdersResponse {
  orders: AdminOrderRow[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 20
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function AdminOrdersPage() {
  const { authHeader } = useAdminAuth()
  const navigate = useNavigate()

  const [orders, setOrders]   = useState<AdminOrderRow[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!authHeader) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (statusFilter) params.set('status', statusFilter)

    fetch(`${BASE}/admin/api/orders?${params}`, {
      headers: { Authorization: authHeader },
    })
      .then(res => {
        if (res.status === 401) throw new Error('UNAUTHORIZED')
        if (!res.ok) throw new Error(`Failed: ${res.status}`)
        return res.json() as Promise<OrdersResponse>
      })
      .then(data => {
        setOrders(data.orders)
        setTotal(data.total)
      })
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false))
  }, [authHeader, page, statusFilter])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>Orders</Typography>

        {/* Status filter (AC8.4) */}
        <FormControl size="small" sx={{ mb: 3, minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={e => { setStatusFilter(e.target.value as Status | ''); setPage(1) }}
          >
            <MenuItem value="">All</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && (
          <>
            {/* Orders table (AC8.2) */}
            <TableContainer component={Paper} sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Customer Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary" py={2}>No orders found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : orders.map(order => (
                    <TableRow
                      key={order.publicId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/orders/${order.publicId}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">{order.publicId}</Typography>
                      </TableCell>
                      <TableCell>{order.customerEmail}</TableCell>
                      <TableCell>
                        <Chip label={order.status} color={STATUS_COLORS[order.status] ?? 'default'} size="small" />
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

            {/* Pagination (AC8.3) */}
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
          </>
        )}
      </Box>
    </Box>
  )
}
