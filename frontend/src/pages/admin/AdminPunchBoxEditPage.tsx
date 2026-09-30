/**
 * AdminPunchBoxEditPage — pre-populated view/edit page for a saved punch box.
 *
 * Loads punch box from GET /admin/api/punch-boxes/:publicId on mount.
 * ASSIGNED: editable quantities (saved per-item on blur/Enter), Mark as Ordered.
 * ORDERED: read-only display.
 *
 * Requirements: R_PREVIEW (ACPV.1–ACPV.7), ACHTML.1–ACHTML.5
 * Design: specs/punch-box/design.md §7.4, §9
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid2,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { adminApi, type AdminProduct, type AdminPunchBoxDetail } from '../../api/admin'
import { downloadPunchBoxHtml } from '../../utils/punchBoxHtml'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function AdminPunchBoxEditPage() {
  const { authHeader } = useAdminAuth()
  const { publicId } = useParams<{ publicId: string }>()
  const navigate = useNavigate()

  const [punchBox, setPunchBox] = useState<AdminPunchBoxDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Products for left column
  const [allProducts, setAllProducts] = useState<AdminProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  // Left panel filters
  const [search, setSearch] = useState('')

  // Pending quantity edits: itemId → new quantity (before save)
  const [pendingQuantities, setPendingQuantities] = useState<Map<number, number>>(new Map())
  const [savingItemId, setSavingItemId] = useState<number | null>(null)
  const [itemError, setItemError] = useState<string | null>(null)

  // Mark as Ordered dialog
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [snackbar, setSnackbar] = useState<string | null>(null)

  // Load punch box
  useEffect(() => {
    if (!authHeader || !publicId) return
    adminApi.getPunchBoxDetail(authHeader, publicId)
      .then(data => setPunchBox(data))
      .catch((err: Error) => {
        if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
          setNotFound(true)
        } else {
          setFetchError('Failed to load punch box.')
        }
      })
      .finally(() => setLoading(false))
  }, [authHeader, publicId])

  // Load products
  useEffect(() => {
    if (!authHeader) return
    adminApi.getProducts(authHeader)
      .then(data => setAllProducts(data.filter(p => p.active)))
      .finally(() => setProductsLoading(false))
  }, [authHeader])

  const isAssigned = punchBox?.status === 'ASSIGNED'

  // Set of product IDs currently in the punch box
  const includedProductIds = useMemo(() => {
    if (!punchBox) return new Set<number>()
    return new Set(punchBox.items.map(i => i.productId).filter((id): id is number => id !== null))
  }, [punchBox])

  const filteredProducts = useMemo(() => {
    return allProducts.filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()),
    )
  }, [allProducts, search])

  async function handleQuantitySave(itemId: number) {
    const newQty = pendingQuantities.get(itemId)
    if (newQty === undefined || !authHeader || !publicId) return
    setSavingItemId(itemId)
    setItemError(null)
    try {
      const updated = await adminApi.patchPunchBoxItem(authHeader, publicId, itemId, { quantity: newQty })
      setPunchBox(updated)
      setPendingQuantities(prev => {
        const next = new Map(prev)
        next.delete(itemId)
        return next
      })
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'Failed to update item.')
    } finally {
      setSavingItemId(null)
    }
  }

  async function handleConfirmOrder() {
    if (!authHeader || !publicId) return
    setOrdering(true)
    setOrderError(null)
    try {
      await adminApi.orderPunchBox(authHeader, publicId)
      setOrderDialogOpen(false)
      setSnackbar('Punch box marked as Ordered!')
      setTimeout(() => navigate('/admin/bundles'), 800)
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to mark as ordered.')
    } finally {
      setOrdering(false)
    }
  }

  function handleGeneratePreview() {
    if (!punchBox) return
    downloadPunchBoxHtml({
      publicId:    punchBox.publicId,
      slotCount:   punchBox.slotCount,
      retailPrice: punchBox.retailPrice,
      items:       punchBox.items.map(i => ({
        productName: i.productNameSnapshot,
        quantity:    i.quantity,
        imageUrl:    i.imageUrl,
      })),
    })
  }

  async function handleDelete() {
    if (!authHeader || !publicId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await adminApi.deletePunchBox(authHeader, publicId)
      setDeleteDialogOpen(false)
      setSnackbar('Punch box deleted.')
      setTimeout(() => navigate('/admin/bundles'), 800)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete punch box.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <>
        <AdminNav />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </>
    )
  }

  if (notFound) {
    return (
      <>
        <AdminNav />
        <Box sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>Punch box not found.</Alert>
          <Link component={RouterLink} to="/admin/bundles">Back to Bundles</Link>
        </Box>
      </>
    )
  }

  if (fetchError || !punchBox) {
    return (
      <>
        <AdminNav />
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{fetchError ?? 'Failed to load punch box.'}</Alert>
        </Box>
      </>
    )
  }

  return (
    <>
      <AdminNav />
      <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', bgcolor: '#F7F7F5' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>
            Punch Box
          </Typography>
          <Typography variant="body2" fontFamily="monospace" color="text.secondary">
            {punchBox.publicId}
          </Typography>
          <Chip
            label={punchBox.status}
            color={punchBox.status === 'ASSIGNED' ? 'info' : 'success'}
            size="small"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        <Grid2 container spacing={3}>
          {/* LEFT COLUMN — Product Table */}
          <Grid2 size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Products</Typography>
              <TextField
                size="small"
                placeholder="Search by name or SKU…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ mb: 2, minWidth: 220 }}
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

              {productsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
                  <TableContainer>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F5F5F5' }}>
                          <TableCell padding="checkbox" />
                          <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Retail ($)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Inventory</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredProducts.map(product => {
                          const isIncluded = includedProductIds.has(product.id)
                          return (
                            <TableRow
                              key={product.id}
                              sx={{ bgcolor: isIncluded ? 'action.selected' : undefined }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={isIncluded}
                                  size="small"
                                  disabled={!isAssigned}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={isIncluded ? 600 : 400}>
                                  {product.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{product.sku}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">{fmt.format(product.retailPrice)}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">{product.inventoryQuantity}</Typography>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Paper>
          </Grid2>

          {/* RIGHT COLUMN — Configuration Panel */}
          <Grid2 size={{ xs: 12, md: 5 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Configuration</Typography>
                <Chip label={`${punchBox.slotCount} slots`} size="small" variant="outlined" />
              </Box>

              {/* Items list */}
              <Typography variant="body2" fontWeight={600} mb={1} color="text.secondary">
                Items ({punchBox.items.length})
              </Typography>
              {itemError && <Alert severity="error" sx={{ mb: 1 }}>{itemError}</Alert>}

              <Box sx={{ maxHeight: 240, overflowY: 'auto', mb: 2 }}>
                <Stack spacing={1}>
                  {punchBox.items.map(item => {
                    const pendingQty = pendingQuantities.get(item.itemId)
                    const displayQty = pendingQty !== undefined ? pendingQty : item.quantity
                    const isSaving = savingItemId === item.itemId
                    return (
                      <Box key={item.itemId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {item.productNameSnapshot}
                        </Typography>
                        {isAssigned ? (
                          <TextField
                            size="small"
                            type="number"
                            value={displayQty}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 1
                              setPendingQuantities(prev => new Map(prev).set(item.itemId, Math.max(1, val)))
                            }}
                            onBlur={() => handleQuantitySave(item.itemId)}
                            onKeyDown={e => { if (e.key === 'Enter') handleQuantitySave(item.itemId) }}
                            disabled={isSaving}
                            slotProps={{ htmlInput: { min: 1, style: { width: 52 } } }}
                            sx={{ width: 72 }}
                          />
                        ) : (
                          <Typography variant="body2" fontWeight={600}>×{item.quantity}</Typography>
                        )}
                        {isSaving && <CircularProgress size={14} />}
                      </Box>
                    )
                  })}
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Pricing summary */}
              <Box sx={{ bgcolor: '#F9F9F9', borderRadius: 1, p: 1.5, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Total COGS</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt.format(punchBox.totalCogsUsd)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Profit</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt.format(punchBox.profitUsd)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Retail Price</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmt.format(punchBox.retailPrice)}</Typography>
                </Box>
              </Box>

              <Button
                variant="outlined"
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                onClick={handleGeneratePreview}
              >
                Generate Preview
              </Button>

              {isAssigned && (
                <>
                  <Button
                    variant="contained"
                    color="warning"
                    fullWidth
                    sx={{ mb: 1 }}
                    onClick={() => setOrderDialogOpen(true)}
                  >
                    Mark as Ordered
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete Punch Box
                  </Button>
                </>
              )}
            </Paper>
          </Grid2>
        </Grid2>
      </Box>

      {/* Mark as Ordered confirmation dialog */}
      <Dialog open={orderDialogOpen} onClose={() => !ordering && setOrderDialogOpen(false)}>
        <DialogTitle>Mark Punch Box as Ordered?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action is irreversible. It will deduct inventory for each product in this punch box
            by its quantity. Do you want to continue?
          </DialogContentText>
          {orderError && <Alert severity="error" sx={{ mt: 2 }}>{orderError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialogOpen(false)} disabled={ordering}>Cancel</Button>
          <Button onClick={handleConfirmOrder} color="warning" variant="contained" disabled={ordering}>
            {ordering ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
            Mark as Ordered
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Punch Box?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete this punch box and remove it from the linked future party.
            The future party can then have a new punch box created for it.
          </DialogContentText>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
