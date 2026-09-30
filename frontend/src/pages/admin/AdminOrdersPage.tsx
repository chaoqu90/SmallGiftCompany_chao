/**
 * AdminOrdersPage — admin order list with status filter, pagination,
 * and inline status change per row.
 *
 * The Status cell is a Select — current value is pre-selected.
 * Changing the value fires PATCH /admin/api/orders/:publicId/status inline.
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
  Snackbar,
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
import { adminApi, type AdminPunchBoxListItem } from '../../api/admin'

const BASE = import.meta.env.VITE_API_BASE_URL as string

// Statuses shown in the inline dropdown for orders
const ADMIN_STATUSES = ['SUBMITTED', 'CONFIRMED', 'SHIPPED', 'CANCELLED'] as const
type AdminStatus = typeof ADMIN_STATUSES[number]

// All statuses for the filter (includes system-generated ones)
const FILTER_STATUSES = ['PENDING', 'SUBMITTED', 'CONFIRMED', 'SHIPPED', 'FULFILLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const

const STATUS_BG: Record<string, string> = {
  PENDING: '#F5F5F5', SUBMITTED: '#E3F2FD', CONFIRMED: '#E8F5E9',
  SHIPPED: '#FFF8E1', FULFILLED: '#FFF8E1',
  COMPLETED: '#E8F5E9', CANCELLED: '#FFEBEE', REFUNDED: '#F5F5F5',
  ORDERED: '#E8F5E9',
}

interface AdminOrderRow {
  publicId:      string
  customerEmail: string
  status:        string
  total:         number
  currency:      string
  itemCount:     number
  createdAt:     string
}

interface OrdersResponse {
  orders: AdminOrderRow[]
  total:  number
  page:   number
  limit:  number
}

// Unified row type for the merged list
type MergedRow =
  | { rowType: 'order';     data: AdminOrderRow }
  | { rowType: 'punch-box'; data: AdminPunchBoxListItem }

const PAGE_SIZE = 20
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function AdminOrdersPage() {
  const { authHeader } = useAdminAuth()
  const navigate = useNavigate()

  const [orders, setOrders]       = useState<AdminOrderRow[]>([])
  const [punchBoxes, setPunchBoxes] = useState<AdminPunchBoxListItem[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [snackbar, setSnackbar]     = useState<string | null>(null)

  useEffect(() => {
    if (!authHeader) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (statusFilter) params.set('status', statusFilter)

    Promise.all([
      fetch(`${BASE}/admin/api/orders?${params}`, {
        headers: { Authorization: authHeader },
      })
        .then(res => {
          if (!res.ok) throw new Error(`${res.status}`)
          return res.json() as Promise<OrdersResponse>
        }),
      adminApi.listPunchBoxes(authHeader),
    ])
      .then(([ordersData, pbData]) => {
        setOrders(ordersData.orders)
        setTotal(ordersData.total)
        setPunchBoxes(pbData.filter(pb => pb.status === 'ORDERED'))
      })
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false))
  }, [authHeader, page, statusFilter])

  async function handleStatusChange(publicId: string, newStatus: AdminStatus) {
    if (!authHeader) return
    setUpdatingId(publicId)
    try {
      const res = await fetch(`${BASE}/admin/api/orders/${publicId}/status`, {
        method: 'PATCH',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnackbar((err as { detail?: string }).detail ?? 'Status update failed.')
        return
      }
      setOrders(prev => prev.map(o => o.publicId === publicId ? { ...o, status: newStatus } : o))
      setSnackbar(`Status updated to ${newStatus}`)
    } catch {
      setSnackbar('Status update failed.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Build merged list: orders + ORDERED punch boxes, filtered and sorted
  const mergedRows: MergedRow[] = (() => {
    const orderRows: MergedRow[] = orders
      .filter(o => {
        // Status filter for orders
        if (!statusFilter) return true
        if (statusFilter === 'ORDERED') return false  // orders don't have ORDERED status
        return o.status === statusFilter
      })
      .map(o => ({ rowType: 'order' as const, data: o }))

    const pbRows: MergedRow[] = punchBoxes
      .filter(() => {
        // Punch boxes (always ORDERED) visible when: no filter, or filter = 'ORDERED'
        if (!statusFilter || statusFilter === 'ORDERED') return true
        return false
      })
      .map(pb => ({ rowType: 'punch-box' as const, data: pb }))

    return [...orderRows, ...pbRows].sort((a, b) => {
      const aDate = a.rowType === 'order' ? a.data.createdAt : a.data.createdAt
      const bDate = b.rowType === 'order' ? b.data.createdAt : b.data.createdAt
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })
  })()

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" fontWeight={700} mb={3}>Orders</Typography>

        <FormControl size="small" sx={{ mb: 3, minWidth: 180 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            label="Filter by Status"
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <MenuItem value="">All</MenuItem>
            {FILTER_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            <MenuItem value="ORDERED">ORDERED (Punch Boxes)</MenuItem>
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
            <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <TableContainer component={Paper} sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: 700 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Customer Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Items / Slots</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mergedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary" py={2}>No orders found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : mergedRows.map(row => {
                    if (row.rowType === 'order') {
                      const order = row.data
                      const isUpdating = updatingId === order.publicId
                      return (
                        <TableRow
                          key={`order-${order.publicId}`}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/admin/orders/${order.publicId}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">{order.publicId}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label="Order" size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{order.customerEmail}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Select
                              size="small"
                              value={order.status}
                              disabled={isUpdating}
                              onChange={e => handleStatusChange(order.publicId, e.target.value as AdminStatus)}
                              onClick={e => e.stopPropagation()}
                              sx={{
                                minWidth: 120,
                                fontWeight: 600,
                                fontSize: 13,
                                bgcolor: STATUS_BG[order.status] ?? '#F5F5F5',
                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                borderRadius: 2,
                              }}
                            >
                              {!ADMIN_STATUSES.includes(order.status as AdminStatus) && (
                                <MenuItem value={order.status} disabled>{order.status}</MenuItem>
                              )}
                              {ADMIN_STATUSES.map(s => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                              ))}
                            </Select>
                            {isUpdating && <CircularProgress size={14} sx={{ ml: 1, verticalAlign: 'middle' }} />}
                          </TableCell>
                          <TableCell align="right">{fmt.format(order.total)}</TableCell>
                          <TableCell align="right">{order.itemCount}</TableCell>
                          <TableCell>
                            {new Intl.DateTimeFormat(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                            }).format(new Date(order.createdAt))}
                          </TableCell>
                        </TableRow>
                      )
                    } else {
                      const pb = row.data
                      return (
                        <TableRow key={`pb-${pb.publicId}`} sx={{ bgcolor: '#FAFAF7' }}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">{pb.publicId}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label="Punch Box" size="small" color="secondary" variant="outlined" />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>—</TableCell>
                          <TableCell>
                            <Chip
                              label="ORDERED"
                              size="small"
                              color="success"
                              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">{fmt.format(pb.retailPrice)}</TableCell>
                          <TableCell align="right">{pb.slotCount} slots</TableCell>
                          <TableCell>
                            {new Intl.DateTimeFormat(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                            }).format(new Date(pb.createdAt))}
                          </TableCell>
                        </TableRow>
                      )
                    }
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            </Box>

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

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
