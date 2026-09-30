import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { adminApi } from '../../api/admin'
import type { AdminBundleListItem, AdminBundleDetail, AdminBundleAssociatedFutureParty, AdminBundleAssociatedOrder, AdminPunchBoxListItem } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  GENERATED: 'default',
  ASSIGNED:  'info',
  ORDERED:   'success',
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface ExpandedRowProps {
  publicId:   string
  authHeader: string
  listRow:    AdminBundleListItem
}

function ExpandedDetail({ publicId, authHeader, listRow }: ExpandedRowProps) {
  const [detail, setDetail] = useState<AdminBundleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.getBundleDetail(authHeader, publicId)
      .then(setDetail)
      .catch(() => setError('Failed to load bundle detail'))
      .finally(() => setLoading(false))
  }, [authHeader, publicId])

  if (loading) return <CircularProgress size={20} sx={{ m: 1 }} />
  if (error) return <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>
  if (!detail) return null

  const futureParties: AdminBundleAssociatedFutureParty[] = detail.futureParties ?? []
  const orders: AdminBundleAssociatedOrder[] = detail.orders ?? []

  return (
    <Box sx={{ px: 3, py: 2 }}>
      {/* Metadata */}
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Interest</Typography>
          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{listRow.interest.replace(/_/g, ' ')}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Party Type</Typography>
          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{listRow.partyType.replace(/_/g, ' ')}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Audience</Typography>
          <Typography variant="body2">{listRow.audiencePreference}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Template</Typography>
          <Typography variant="body2">{listRow.templateCode}</Typography>
        </Box>
      </Box>

      {/* Items table */}
      {detail.items.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                <TableCell sx={{ fontWeight: 700 }}>Slot</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Form Factor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.items.map(item => (
                <TableRow key={item.slotCode}>
                  <TableCell>{item.slotCode}</TableCell>
                  <TableCell>
                    <Link component={RouterLink} to="/admin/products" sx={{ fontSize: '0.875rem' }}>
                      {item.productName}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.sku}</TableCell>
                  <TableCell>{item.formFactor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Associated Future Parties */}
      {futureParties.length > 0 && (
        <>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Associated Future {futureParties.length === 1 ? 'Party' : 'Parties'}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Party Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Child</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {futureParties.map(fp => (
                  <TableRow key={fp.id}>
                    <TableCell>
                      <Link component={RouterLink} to="/admin/future-parties" sx={{ fontSize: '0.875rem' }}>
                        {fp.email}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(fp.partyDate).toLocaleDateString()}</TableCell>
                    <TableCell>{fp.kidGender} · age {fp.kidAge}</TableCell>
                    <TableCell>{new Date(fp.submittedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Associated Orders */}
      {orders.length > 0 && (
        <>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Associated {orders.length === 1 ? 'Order' : 'Orders'}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ width: '100%' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Order ID</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map(order => (
                  <TableRow key={order.publicId}>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/admin/orders/${order.publicId}`}
                        sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {order.publicId}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customerEmail}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>{fmt.format(Number(order.total))}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  )
}

// Unified row type for the merged bundles + punch boxes list
type BundlesPageRow =
  | { rowType: 'bundle';    data: AdminBundleListItem }
  | { rowType: 'punch-box'; data: AdminPunchBoxListItem }

export function AdminBundlesPage() {
  const { authHeader } = useAdminAuth()
  const navigate = useNavigate()
  const [bundles, setBundles]       = useState<AdminBundleListItem[]>([])
  const [punchBoxes, setPunchBoxes] = useState<AdminPunchBoxListItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [idSearch, setIdSearch]         = useState<string>('')
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearing, setClearing]           = useState(false)
  const [clearSnackbar, setClearSnackbar] = useState<string | null>(null)

  // Mark as Ordered dialog state
  const [orderConfirmPb, setOrderConfirmPb]   = useState<AdminPunchBoxListItem | null>(null)
  const [ordering, setOrdering]               = useState(false)
  const [orderError, setOrderError]           = useState<string | null>(null)

  useEffect(() => {
    if (!authHeader) return
    Promise.all([
      adminApi.getBundles(authHeader),
      adminApi.listPunchBoxes(authHeader),
    ])
      .then(([bundlesData, pbData]) => { setBundles(bundlesData); setPunchBoxes(pbData) })
      .catch(() => setError('Failed to load bundles'))
      .finally(() => setLoading(false))
  }, [authHeader])

  function toggleRow(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  async function handleClearIdle() {
    if (!authHeader) return
    setClearing(true)
    try {
      const { deleted } = await adminApi.clearIdleBundles(authHeader)
      setBundles(prev => prev.filter(b => b.status !== 'GENERATED'))
      setExpandedId(null)
      setClearSnackbar(`Deleted ${deleted} idle bundle${deleted !== 1 ? 's' : ''}`)
    } catch {
      setClearSnackbar('Failed to clear idle bundles')
    } finally {
      setClearing(false)
      setClearConfirmOpen(false)
    }
  }

  async function handleConfirmOrder() {
    if (!authHeader || !orderConfirmPb) return
    setOrdering(true)
    setOrderError(null)
    try {
      await adminApi.orderPunchBox(authHeader, orderConfirmPb.publicId)
      setPunchBoxes(prev => prev.map(pb =>
        pb.publicId === orderConfirmPb.publicId ? { ...pb, status: 'ORDERED' as const } : pb,
      ))
      setOrderConfirmPb(null)
      setClearSnackbar('Punch box marked as Ordered!')
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to mark as ordered.')
    } finally {
      setOrdering(false)
    }
  }

  // Build merged row list
  const allRows: BundlesPageRow[] = [
    ...bundles.map(b => ({ rowType: 'bundle' as const, data: b })),
    ...punchBoxes.map(pb => ({ rowType: 'punch-box' as const, data: pb })),
  ].sort((a, b) =>
    new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime(),
  )

  const visibleRows = allRows.filter(row => {
    const matchesStatus = !statusFilter || row.data.status === statusFilter
    const matchesSearch = !idSearch || row.data.publicId.toLowerCase().includes(idSearch.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>Bundles</Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => setClearConfirmOpen(true)}
            disabled={clearing || bundles.filter(b => b.status === 'GENERATED').length === 0}
          >
            Clear All Idle Bundles
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by ID…"
            value={idSearch}
            onChange={e => { setIdSearch(e.target.value); setExpandedId(null) }}
            sx={{ minWidth: 240 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={statusFilter}
              label="Filter by Status"
              onChange={e => { setStatusFilter(e.target.value); setExpandedId(null) }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="GENERATED">Generated</MenuItem>
              <MenuItem value="ASSIGNED">Assigned</MenuItem>
              <MenuItem value="ORDERED">Ordered</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && !error && (
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <TableContainer component={Paper} sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: 600 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Retail Price</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary" py={2}>No bundles found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : visibleRows.map(row => {
                    const rowId = row.data.publicId
                    const isExpanded = expandedId === rowId

                    if (row.rowType === 'bundle') {
                      const bundle = row.data
                      return (
                        <>
                          <TableRow
                            key={bundle.publicId}
                            hover
                            sx={{ cursor: 'pointer', '& > td': { borderBottom: isExpanded ? 0 : undefined } }}
                            onClick={() => toggleRow(bundle.publicId)}
                          >
                            <TableCell>
                              <IconButton size="small" sx={{ p: 0 }}>
                                {isExpanded
                                  ? <KeyboardArrowDownIcon fontSize="small" />
                                  : <KeyboardArrowRightIcon fontSize="small" />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Chip label="Bundle" size="small" variant="outlined" />
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {bundle.publicId}
                            </TableCell>
                            <TableCell>
                              {bundle.baseRetailPrice != null ? fmt.format(bundle.baseRetailPrice) : '—'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={bundle.status}
                                color={STATUS_COLOR[bundle.status] ?? 'default'}
                                size="small"
                                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                              />
                            </TableCell>
                            <TableCell>{new Date(bundle.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell />
                          </TableRow>
                          <TableRow key={`${bundle.publicId}-detail`}>
                            <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                              <Collapse in={isExpanded} unmountOnExit>
                                <Box sx={{ bgcolor: '#FAFAFA', borderBottom: '1px solid rgba(224,224,224,1)' }}>
                                  {authHeader && (
                                    <ExpandedDetail
                                      publicId={bundle.publicId}
                                      authHeader={authHeader}
                                      listRow={bundle}
                                    />
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </>
                      )
                    } else {
                      // Punch box row
                      const pb = row.data
                      return (
                        <>
                          <TableRow
                            key={pb.publicId}
                            hover
                            sx={{ cursor: 'pointer', '& > td': { borderBottom: isExpanded ? 0 : undefined } }}
                            onClick={() => toggleRow(pb.publicId)}
                          >
                            <TableCell>
                              <IconButton size="small" sx={{ p: 0 }}>
                                {isExpanded
                                  ? <KeyboardArrowDownIcon fontSize="small" />
                                  : <KeyboardArrowRightIcon fontSize="small" />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Chip label="Punch Box" size="small" color="secondary" variant="outlined" />
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {pb.publicId}
                            </TableCell>
                            <TableCell>{fmt.format(pb.retailPrice)}</TableCell>
                            <TableCell>
                              <Chip
                                label={pb.status}
                                color={pb.status === 'ORDERED' ? 'success' : 'info'}
                                size="small"
                                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                              />
                            </TableCell>
                            <TableCell>{new Date(pb.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell onClick={e => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                              <Tooltip title="View Punch Box">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/admin/punch-box/${pb.publicId}`)}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {pb.status === 'ASSIGNED' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  sx={{ ml: 1, fontSize: '0.7rem' }}
                                  onClick={() => { setOrderConfirmPb(pb); setOrderError(null) }}
                                >
                                  Mark as Ordered
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow key={`${pb.publicId}-detail`}>
                            <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                              <Collapse in={isExpanded} unmountOnExit>
                                <Box sx={{ bgcolor: '#FAFAFA', borderBottom: '1px solid rgba(224,224,224,1)', px: 3, py: 2 }}>
                                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 1 }}>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Slot Count</Typography>
                                      <Typography variant="body2">{pb.slotCount}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Total COGS</Typography>
                                      <Typography variant="body2">{fmt.format(pb.totalCogsUsd)}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Profit</Typography>
                                      <Typography variant="body2">{fmt.format(pb.profitUsd)}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Retail Price</Typography>
                                      <Typography variant="body2" fontWeight={700}>{fmt.format(pb.retailPrice)}</Typography>
                                    </Box>
                                    {pb.futurePartyId && (
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">Future Party</Typography>
                                        <Typography variant="body2">#{pb.futurePartyId}</Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </>
                      )
                    }
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>

      {/* Clear Idle Bundles confirm dialog */}
      <Dialog open={clearConfirmOpen} onClose={() => !clearing && setClearConfirmOpen(false)}>
        <DialogTitle>Clear All Idle Bundles?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete all <strong>{bundles.filter(b => b.status === 'GENERATED').length}</strong> bundle{bundles.filter(b => b.status === 'GENERATED').length !== 1 ? 's' : ''} in GENERATED status. Bundles linked to future parties or orders will not be affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)} disabled={clearing}>Cancel</Button>
          <Button onClick={handleClearIdle} color="error" variant="contained" disabled={clearing}>
            {clearing ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as Ordered confirm dialog */}
      <Dialog open={orderConfirmPb !== null} onClose={() => !ordering && setOrderConfirmPb(null)}>
        <DialogTitle>Mark Punch Box as Ordered?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action is irreversible. It will deduct inventory for each product in this punch box
            by its quantity. Do you want to continue?
          </DialogContentText>
          {orderError && <Alert severity="error" sx={{ mt: 2 }}>{orderError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderConfirmPb(null)} disabled={ordering}>Cancel</Button>
          <Button onClick={handleConfirmOrder} color="warning" variant="contained" disabled={ordering}>
            {ordering ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
            Mark as Ordered
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={clearSnackbar !== null}
        autoHideDuration={3500}
        onClose={() => setClearSnackbar(null)}
        message={clearSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
