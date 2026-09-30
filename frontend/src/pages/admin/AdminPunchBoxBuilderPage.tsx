/**
 * AdminPunchBoxBuilderPage — two-column punch box builder.
 *
 * Left column: filterable product table (active products only).
 * Right column: size selection, selected products list with editable
 * quantities, pricing panel, Generate Preview, Generate Punch Box.
 *
 * Requirements: R2 (AC2.1–AC2.10), R3 (AC3.1–AC3.8), R8 (AC8.1–AC8.6)
 * Design: specs/punch-box/design.md §7.3
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid2,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import SearchIcon from '@mui/icons-material/Search'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { adminApi, type AdminProduct } from '../../api/admin'
import { downloadPunchBoxHtml } from '../../utils/punchBoxHtml'

// ─── Retail pricing formula (mirrors backend src/services/retailPricing.ts) ──

function computeRetailPrice(cogAdjusted: number): number {
  let price: number
  if (cogAdjusted < 1.0) {
    price = 0.5
  } else if (cogAdjusted < 4.0) {
    price = cogAdjusted / 2
  } else if (cogAdjusted < 10.0) {
    price = cogAdjusted / 3 + 2 / 3
  } else {
    price = cogAdjusted * 0.4
  }
  return Math.round(price * 100) / 100
}

const SLOT_SIZES = [30, 50, 70] as const
type SlotSize = typeof SLOT_SIZES[number]

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminPunchBoxBuilderPage() {
  const { authHeader } = useAdminAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const futurePartyIdParam = searchParams.get('futurePartyId')
  const futurePartyId = futurePartyIdParam ? parseInt(futurePartyIdParam, 10) : undefined

  // Product data
  const [allProducts, setAllProducts] = useState<AdminProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  // Selection: productId → { product, quantity }
  const [selectedItems, setSelectedItems] = useState<Map<number, { product: AdminProduct; quantity: number }>>(new Map())

  // Configuration
  const [slotCount, setSlotCount] = useState<SlotSize | null>(null)
  const [retailPrice, setRetailPrice] = useState<string>('')
  const [profit, setProfit] = useState<string>('')
  const [priceCalculated, setPriceCalculated] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<string | null>(null)

  // Load products
  useEffect(() => {
    if (!authHeader) return
    adminApi.getProducts(authHeader)
      .then(data => setAllProducts(data.filter(p => p.active)))
      .catch(() => setProductsError('Failed to load products.'))
      .finally(() => setProductsLoading(false))
  }, [authHeader])

  // Derived: all categories from active products
  const categories = useMemo(() => {
    const cats = new Set(allProducts.map(p => p.category))
    return Array.from(cats).sort()
  }, [allProducts])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      const matchesSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !categoryFilter || p.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [allProducts, search, categoryFilter])

  // Pricing calculations
  const totalCogsUsd = useMemo(() => {
    let total = 0
    for (const { product, quantity } of selectedItems.values()) {
      total += (product.cost / 6.5) * quantity
    }
    return Math.round(total * 100) / 100
  }, [selectedItems])

  const suggestedRetailPrice = useMemo(() => {
    let total = 0
    for (const { product, quantity } of selectedItems.values()) {
      total += computeRetailPrice(product.cogAdjusted) * quantity
    }
    return Math.round(total * 100) / 100
  }, [selectedItems])

  function handleCalculatePrice() {
    const retail = suggestedRetailPrice
    const prof = Math.round((retail - totalCogsUsd) * 100) / 100
    setRetailPrice(retail.toFixed(2))
    setProfit(prof.toFixed(2))
    setPriceCalculated(true)
  }

  function handleRetailPriceChange(val: string) {
    setRetailPrice(val)
    const r = parseFloat(val)
    if (!isNaN(r)) {
      setProfit((Math.round((r - totalCogsUsd) * 100) / 100).toFixed(2))
    }
  }

  function handleProfitChange(val: string) {
    setProfit(val)
    const p = parseFloat(val)
    if (!isNaN(p)) {
      setRetailPrice((Math.round((totalCogsUsd + p) * 100) / 100).toFixed(2))
    }
  }

  function toggleProduct(product: AdminProduct) {
    setSelectedItems(prev => {
      const next = new Map(prev)
      if (next.has(product.id)) {
        next.delete(product.id)
      } else {
        next.set(product.id, { product, quantity: 1 })
      }
      return next
    })
    setPriceCalculated(false)
  }

  function setQuantity(productId: number, quantity: number) {
    setSelectedItems(prev => {
      const next = new Map(prev)
      const entry = next.get(productId)
      if (entry) {
        next.set(productId, { ...entry, quantity: Math.max(1, quantity) })
      }
      return next
    })
    setPriceCalculated(false)
  }

  function handleGeneratePreview() {
    const items = Array.from(selectedItems.values()).map(({ product, quantity }) => ({
      productName: product.name,
      quantity,
    }))
    downloadPunchBoxHtml({
      publicId:     null,
      slotCount,
      items,
      totalCogsUsd,
      profitUsd:    parseFloat(profit) || 0,
      retailPrice:  parseFloat(retailPrice) || 0,
    })
  }

  async function handleGenerate() {
    setSubmitError(null)

    // Validation (AC3.6)
    if (selectedItems.size === 0) {
      setSubmitError('Please select at least one product.')
      return
    }
    if (!slotCount) {
      setSubmitError('Please select a punch box size.')
      return
    }
    const rp = parseFloat(retailPrice)
    if (isNaN(rp) || rp <= 0) {
      setSubmitError('Retail price must be greater than zero.')
      return
    }

    setSubmitting(true)
    try {
      const items = Array.from(selectedItems.values()).map(({ product, quantity }, idx) => ({
        productId:    product.id,
        quantity,
        displayOrder: idx,
      }))
      await adminApi.createPunchBox(authHeader!, {
        futurePartyId,
        slotCount,
        retailPrice: rp,
        items,
      })
      setSnackbar('Punch box created successfully!')
      setTimeout(() => navigate('/admin/bundles'), 800)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create punch box.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedList = Array.from(selectedItems.values())

  return (
    <>
      <AdminNav />
      <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', bgcolor: '#F7F7F5' }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          New Punch Box
          {futurePartyId ? ` (Future Party #${futurePartyId})` : ''}
        </Typography>

        <Grid2 container spacing={3}>
          {/* LEFT COLUMN — Product Table */}
          <Grid2 size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Products</Typography>

              <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                <TextField
                  size="small"
                  placeholder="Search by name or SKU…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  sx={{ minWidth: 220 }}
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
                <Chip
                  label="All"
                  variant={!categoryFilter ? 'filled' : 'outlined'}
                  onClick={() => setCategoryFilter('')}
                  size="small"
                  sx={{ cursor: 'pointer' }}
                />
                {categories.map(cat => (
                  <Chip
                    key={cat}
                    label={cat}
                    variant={categoryFilter === cat ? 'filled' : 'outlined'}
                    onClick={() => setCategoryFilter(prev => prev === cat ? '' : cat)}
                    size="small"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>

              {productsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              )}
              {productsError && <Alert severity="error">{productsError}</Alert>}
              {!productsLoading && !productsError && (
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
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              <Typography color="text.secondary" py={2} variant="body2">No products found.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : filteredProducts.map(product => {
                          const isSelected = selectedItems.has(product.id)
                          return (
                            <TableRow
                              key={product.id}
                              hover
                              onClick={() => toggleProduct(product)}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: isSelected ? 'action.selected' : undefined,
                              }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={isSelected}
                                  size="small"
                                  onClick={e => e.stopPropagation()}
                                  onChange={() => toggleProduct(product)}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
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
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Configuration</Typography>

              {/* Punch Box Size */}
              <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                <InputLabel>Punch Box Size</InputLabel>
                <Select
                  value={slotCount ?? ''}
                  label="Punch Box Size"
                  onChange={e => { setSlotCount(Number(e.target.value) as SlotSize); setPriceCalculated(false) }}
                >
                  {SLOT_SIZES.map(s => (
                    <MenuItem key={s} value={s}>{s} slots</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Selected products */}
              <Typography variant="body2" fontWeight={600} mb={1} color="text.secondary">
                Selected Products ({selectedList.length})
              </Typography>

              {selectedList.length === 0 ? (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  No products selected. Check products in the left table.
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 220, overflowY: 'auto', mb: 2 }}>
                  <Stack spacing={1}>
                    {selectedList.map(({ product, quantity }) => (
                      <Box key={product.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{product.name}</Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={quantity}
                          onChange={e => setQuantity(product.id, parseInt(e.target.value) || 1)}
                          slotProps={{ htmlInput: { min: 1, style: { width: 52 } } }}
                          sx={{ width: 72 }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Pricing */}
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={handleCalculatePrice}
                sx={{ mb: 2 }}
                disabled={selectedList.length === 0}
              >
                Calculate Retail Price
              </Button>

              <Box sx={{ bgcolor: '#F9F9F9', borderRadius: 1, p: 1.5, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Total COGS</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt.format(totalCogsUsd)}</Typography>
                </Box>
                <TextField
                  label="Profit ($)"
                  size="small"
                  fullWidth
                  value={profit}
                  onChange={e => handleProfitChange(e.target.value)}
                  disabled={!priceCalculated}
                  sx={{ mb: 1 }}
                />
                <TextField
                  label="Retail Price ($)"
                  size="small"
                  fullWidth
                  value={retailPrice}
                  onChange={e => handleRetailPriceChange(e.target.value)}
                  disabled={!priceCalculated}
                />
              </Box>

              {submitError && (
                <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>
              )}

              <Button
                variant="outlined"
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                onClick={handleGeneratePreview}
                disabled={selectedList.length === 0}
              >
                Generate Preview
              </Button>

              <Button
                variant="contained"
                fullWidth
                onClick={handleGenerate}
                disabled={submitting}
              >
                {submitting ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                Generate Punch Box
              </Button>
            </Paper>
          </Grid2>
        </Grid2>
      </Box>

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
