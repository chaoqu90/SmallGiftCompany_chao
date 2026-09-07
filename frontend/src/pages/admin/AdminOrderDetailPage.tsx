/**
 * AdminOrderDetailPage — admin view of a single order with status update.
 *
 * Route: /admin/orders/:publicId
 * Fetches from GET /admin/api/orders/:publicId.
 * Status update via PATCH /admin/api/orders/:publicId/status.
 * Only valid forward transitions per design.md §3 are offered (AC8.9).
 *
 * Requirements: R8 (AC8.6–AC8.10)
 */
import { useEffect, useState } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Skeleton,
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

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'

// Valid forward transitions per design.md §3 (AC8.9)
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['FULFILLED', 'CANCELLED', 'REFUNDED'],
  FULFILLED:  ['COMPLETED', 'CANCELLED', 'REFUNDED'],
  COMPLETED:  [],
  CANCELLED:  [],
  REFUNDED:   [],
}

type ChipColor = 'default' | 'info' | 'warning' | 'success' | 'error'
const STATUS_COLORS: Record<string, ChipColor> = {
  PENDING: 'default', CONFIRMED: 'info', FULFILLED: 'warning',
  COMPLETED: 'success', CANCELLED: 'error', REFUNDED: 'default',
}

interface BundleItem {
  slotCode: string
  productName: string
  sku: string
  formFactor: string
  quantityPerBag: number
  displayOrder: number
  description: string | null
}

interface LineItem {
  id: number
  bundlePublicId: string
  interest: string
  requestedAge: number
  partyType: string
  upgradeTier: string
  giftBagName: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  bundleItems: BundleItem[]
}

interface AdminOrderDetail {
  publicId: string
  status: string
  subtotal: number
  total: number
  currency: string
  customerEmail: string
  customerName: string | null
  itemCount: number
  createdAt: string
  shippingStreet: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingZip: string | null
  shippingCountry: string | null
  lineItems: LineItem[]
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function AdminOrderDetailPage() {
  const { publicId } = useParams<{ publicId: string }>()
  const { authHeader } = useAdminAuth()

  const [order, setOrder]     = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!authHeader || !publicId) return
    setLoading(true)
    fetch(`${BASE}/admin/api/orders/${publicId}`, {
      headers: { Authorization: authHeader },
    })
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null }
        if (!res.ok) throw new Error(`Failed: ${res.status}`)
        return res.json() as Promise<AdminOrderDetail>
      })
      .then(data => { if (data) setOrder(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [authHeader, publicId])

  async function handleStatusChange(newStatus: string) {
    if (!authHeader || !publicId || !order) return
    setStatusError(null)
    setUpdatingStatus(true)
    try {
      const res = await fetch(`${BASE}/admin/api/orders/${publicId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization:  authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Status update failed.' }))
        setStatusError(err.detail ?? 'Status update failed.')
        return
      }
      setOrder(prev => prev ? { ...prev, status: newStatus } : prev)
    } catch {
      setStatusError('Status update failed. Please try again.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
        <AdminNav />
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={120} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={200} />
        </Box>
      </Box>
    )
  }

  if (notFound || !order) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
        <AdminNav />
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" mb={2}>Order not found</Typography>
          <Link component={RouterLink} to="/admin/orders">Back to Orders</Link>
        </Box>
      </Box>
    )
  }

  const allowedTransitions = VALID_TRANSITIONS[order.status as OrderStatus] ?? []

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: 3, maxWidth: 900 }}>
        {/* Header (AC8.6) */}
        <Paper sx={{ p: 3, mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Order ID</Typography>
              <Typography variant="h6" fontFamily="monospace">{order.publicId}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Customer</Typography>
              <Typography>{order.customerEmail}</Typography>
              {order.customerName && (
                <Typography variant="body2" color="text.secondary">{order.customerName}</Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Created</Typography>
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

          <Divider sx={{ my: 2 }} />

          {/* Current status + update control (AC8.8) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Current Status</Typography>
              <Chip label={order.status} color={STATUS_COLORS[order.status] ?? 'default'} />
            </Box>

            {/* Status update dropdown — only shows valid transitions (AC8.9) */}
            {allowedTransitions.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Update Status</InputLabel>
                <Select
                  value=""
                  label="Update Status"
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  displayEmpty
                >
                  {allowedTransitions.map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {updatingStatus && <CircularProgress size={20} />}
          </Box>

          {/* Status update error (AC9.9) */}
          {statusError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setStatusError(null)}>
              {statusError}
            </Alert>
          )}
        </Paper>

        {/* Shipping Address */}
        {(order.shippingStreet || order.shippingCity) && (
          <>
            <Typography variant="h6" fontWeight={700} mb={2}>Shipping Address</Typography>
            <Paper sx={{ p: 3, mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Typography variant="body2">{order.shippingStreet}</Typography>
              <Typography variant="body2">
                {[order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(', ')}
              </Typography>
              {order.shippingCountry && (
                <Typography variant="body2">{order.shippingCountry}</Typography>
              )}
            </Paper>
          </>
        )}

        {/* Line items table (AC8.7) */}
        <Typography variant="h6" fontWeight={700} mb={2}>Line Items</Typography>
        <TableContainer component={Paper} sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
                <>
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
                    <TableCell>{li.giftBagName ?? 'None'}</TableCell>
                    <TableCell align="right">{li.quantity}</TableCell>
                    <TableCell align="right">{fmt.format(li.unitPrice)}</TableCell>
                    <TableCell align="right">{fmt.format(li.lineTotal)}</TableCell>
                  </TableRow>
                  {/* Bundle product items sub-rows */}
                  {li.bundleItems.length > 0 && (
                    <TableRow key={`${li.id}-items`} sx={{ bgcolor: '#FAFAFA' }}>
                      <TableCell colSpan={6} sx={{ py: 1, px: 3 }}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                          Bundle contents:
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                          {li.bundleItems.map(bi => (
                            <Box component="li" key={bi.slotCode} sx={{ mb: 0.25 }}>
                              <Typography variant="caption">
                                <strong>{bi.productName}</strong>
                                {' '}
                                <span style={{ color: '#666' }}>
                                  ({bi.sku} · {bi.formFactor}
                                  {bi.quantityPerBag > 1 ? ` × ${bi.quantityPerBag}` : ''})
                                </span>
                                {bi.description && (
                                  <span style={{ color: '#888' }}> — {bi.description}</span>
                                )}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {/* Total row */}
              <TableRow>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 700 }}>Order Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt.format(order.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Link component={RouterLink} to="/admin/orders">Back to Orders</Link>
      </Box>
    </Box>
  )
}
