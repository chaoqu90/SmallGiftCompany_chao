import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  ClickAwayListener,
  MenuItem,
  Paper,
  Popover,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { adminApi } from '../../api/admin'
import type { AdminProduct } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { ProductAffinityDialog } from './ProductAffinityDialog'
import { ProductPricingDialog } from './ProductPricingDialog'
import { AddProductDialog } from './AddProductDialog'

const CATEGORIES    = ['ACCESSORY','ACTIVITY','BOOK','COLLECTIBLE','NOVELTY','OTHER','PUZZLE','SPORT','STATIONERY','STICKER_TATTOO','TOY','WEARABLE']
const UPGRADE_TIERS = ['STANDARD','PREMIUM']
const FORM_FACTORS  = ['BAG','BAR','CUBE','FLAT_RECT','IRREGULAR_VOLUME','OTHER','ROUND','SMALL_VOLUME']
const MIN_AGES      = [3, 6, 9]
const MAX_AGES      = [5, 8, 12]

export function AdminProductsPage() {
  const { authHeader } = useAdminAuth()
  const [products,       setProducts]       = useState<AdminProduct[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<{ id: number; name: string } | null>(null)
  const [pricingProduct, setPricingProduct] = useState<{ id: number; name: string; cost: number; cogOverhead: number } | null>(null)
  const [addOpen,        setAddOpen]        = useState(false)
  const [deleteError,    setDeleteError]    = useState<string | null>(null)

  useEffect(() => {
    if (!authHeader) return
    adminApi.getProducts(authHeader)
      .then(setProducts)
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [authHeader])

  // Active rows first, then inactive; within each group sort by SKU
  const sortedProducts = useMemo(() =>
    [...products].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.sku.localeCompare(b.sku)
    }),
    [products]
  )

  async function handleInventoryChange(id: number, quantity: number) {
    if (!authHeader) return
    try {
      const updated = await adminApi.updateInventory(authHeader, id, quantity)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch {
      // silent — field will revert on next render if state wasn't updated
    }
  }

  async function handleActiveToggle(id: number, currentActive: boolean) {
    if (!authHeader) return
    try {
      const updated = await adminApi.setActive(authHeader, id, !currentActive)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch {
      // silent
    }
  }

  async function handleFormFactorChange(id: number, formFactor: string) {
    if (!authHeader) return
    const current = products.find(p => p.id === id)
    if (!current) return
    try {
      // Reuse /details endpoint — pass unchanged name+category alongside new formFactor
      const updated = await adminApi.updateDetails(authHeader, id, current.name, current.category, formFactor)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch { /* silent */ }
  }

  async function handleUpgradeTierChange(id: number, tier: string) {
    if (!authHeader) return
    try {
      const updated = await adminApi.updateUpgradeTier(authHeader, id, tier)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch { /* silent */ }
  }

  async function handleAgeRangeChange(id: number, minAge: number, maxAge: number) {
    if (!authHeader) return
    try {
      const updated = await adminApi.updateAgeRange(authHeader, id, minAge, maxAge)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch { /* silent */ }
  }

  async function handleDetailsChange(id: number, name: string, category: string, formFactor: string) {
    if (!authHeader) return
    try {
      const updated = await adminApi.updateDetails(authHeader, id, name, category, formFactor)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch { /* silent */ }
  }

  async function handleDelete(id: number) {
    if (!authHeader) return
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    try {
      await adminApi.deleteProduct(authHeader, id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : 'Delete failed'
      setDeleteError(
        msg.includes('409') || msg.includes('bundle')
          ? 'Cannot delete — product is used in existing bundles. Deactivate it instead.'
          : 'Delete failed'
      )
    }
  }

  function handleProductSaved(updated: AdminProduct) {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleProductCreated(created: AdminProduct) {
    setProducts(prev => [...prev, created])
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Products</Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => setAddOpen(true)}
            sx={{ backgroundColor: '#F47F6B', '&:hover': { backgroundColor: '#e06b57' } }}
          >
            + Add Product
          </Button>
        </Box>

        {deleteError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError(null)}>
            {deleteError}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && !error && (
          <TableContainer component={Paper} sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Form Factor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Upgrade Tier</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Age Range</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Retail Price</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Inventory</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Interest Weight</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedProducts.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onInventoryChange={handleInventoryChange}
                    onActiveToggle={handleActiveToggle}
                    onEditAttributes={(id, name) => setEditingProduct({ id, name })}
                    onPriceClick={(id, name, cost, cogOverhead) =>
                      setPricingProduct({ id, name, cost, cogOverhead })
                    }
                    onFormFactorChange={handleFormFactorChange}
                    onUpgradeTierChange={handleUpgradeTierChange}
                    onAgeRangeChange={handleAgeRangeChange}
                    onDetailsChange={handleDetailsChange}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <ProductAffinityDialog
        productId={editingProduct?.id ?? null}
        productName={editingProduct?.name ?? ''}
        onClose={() => setEditingProduct(null)}
      />

      <ProductPricingDialog
        productId={pricingProduct?.id ?? null}
        productName={pricingProduct?.name ?? ''}
        currentCost={pricingProduct?.cost ?? 0}
        currentCogOverhead={pricingProduct?.cogOverhead ?? 0}
        onClose={() => setPricingProduct(null)}
        onSaved={handleProductSaved}
      />

      <AddProductDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleProductCreated}
      />
    </Box>
  )
}

interface ProductRowProps {
  product:              AdminProduct
  onInventoryChange:    (id: number, quantity: number) => void
  onActiveToggle:       (id: number, currentActive: boolean) => void
  onEditAttributes:     (id: number, name: string) => void
  onPriceClick:         (id: number, name: string, cost: number, cogOverhead: number) => void
  onFormFactorChange:   (id: number, formFactor: string) => void
  onUpgradeTierChange:  (id: number, tier: string) => void
  onAgeRangeChange:     (id: number, minAge: number, maxAge: number) => void
  onDetailsChange:      (id: number, name: string, category: string, formFactor: string) => void
  onDelete:             (id: number) => void
}

function ProductRow({
  product,
  onInventoryChange,
  onActiveToggle,
  onEditAttributes,
  onPriceClick,
  onFormFactorChange,
  onUpgradeTierChange,
  onAgeRangeChange,
  onDetailsChange,
  onDelete,
}: ProductRowProps) {
  const [localQty,          setLocalQty]          = useState(String(product.inventoryQuantity))
  const [editingFormFactor, setEditingFormFactor] = useState(false)
  const [editingTier,       setEditingTier]       = useState(false)

  // Age range inline edit
  const [editingAge,   setEditingAge]   = useState(false)
  const [localMin,     setLocalMin]     = useState<number>(product.minAge)
  const [localMax,     setLocalMax]     = useState<number>(product.maxAge)
  // Tracks whether any age-range Select dropdown is currently open.
  // Used to suppress ClickAwayListener firing on portal (dropdown) clicks.
  const ageSelectOpen = useRef(false)

  // Name / details popover
  const [anchorEl,        setAnchorEl]        = useState<HTMLElement | null>(null)
  const [localName,       setLocalName]       = useState(product.name)
  const [localDetailCat,  setLocalDetailCat]  = useState(product.category)
  const [localFormFactor, setLocalFormFactor] = useState(product.formFactor)

  // Keep local qty in sync if parent updates (e.g. after a successful PATCH)
  useEffect(() => {
    setLocalQty(String(product.inventoryQuantity))
  }, [product.inventoryQuantity])

  useEffect(() => {
    setLocalMin(product.minAge)
    setLocalMax(product.maxAge)
  }, [product.minAge, product.maxAge])

  useEffect(() => {
    setLocalName(product.name)
  }, [product.name])

  useEffect(() => {
    setLocalDetailCat(product.category)
    setLocalFormFactor(product.formFactor)
  }, [product.category, product.formFactor])

  function commitQty() {
    const parsed = parseInt(localQty, 10)
    if (!isNaN(parsed) && parsed !== product.inventoryQuantity) {
      onInventoryChange(product.id, parsed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  function handleMinChange(newMin: number) {
    setLocalMin(newMin)
    const validMaxes = MAX_AGES.filter(m => m > newMin)
    if (!validMaxes.includes(localMax)) {
      setLocalMax(validMaxes[0])
    }
  }

  function handleMaxChange(newMax: number) {
    setLocalMax(newMax)
    // Explicit max selection — commit immediately and close
    onAgeRangeChange(product.id, localMin, newMax)
    setEditingAge(false)
  }

  // Called when clicking outside the age-range cell.
  // Skipped while a Select dropdown is open (portal clicks falsely trigger ClickAwayListener).
  // The setTimeout delay lets onClose fire and clear the flag before we check it.
  function commitAgeAndClose() {
    if (ageSelectOpen.current) return
    const validMaxes = MAX_AGES.filter(m => m > localMin)
    const effectiveMax = validMaxes.includes(localMax) ? localMax : validMaxes[0]
    if (localMin !== product.minAge || effectiveMax !== product.maxAge) {
      onAgeRangeChange(product.id, localMin, effectiveMax)
    }
    setEditingAge(false)
  }

  function saveDetails() {
    if (localName.trim()) {
      onDetailsChange(product.id, localName.trim(), localDetailCat, localFormFactor)
    }
    setAnchorEl(null)
  }

  // cogOverhead is not in the DTO; derive it from cogAdjusted - cost
  const cogOverhead = product.cogAdjusted - product.cost

  return (
    <TableRow hover>
      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{product.sku}</TableCell>

      {/* Name cell — click opens details popover */}
      <TableCell>
        <Typography
          onClick={e => {
            setLocalName(product.name)
            setLocalDetailCat(product.category)
            setLocalFormFactor(product.formFactor)
            setAnchorEl(e.currentTarget)
          }}
          sx={{ fontSize: '0.875rem', cursor: 'pointer', '&:hover': { color: '#F47F6B' } }}
        >
          {product.name}
        </Typography>

        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ sx: { p: 2, width: 280, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: '#6E6E73', mb: 0.5 }}>Name</Typography>
          <input
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', border: '1px solid #E5E5EA', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: '#6E6E73', mb: 0.5 }}>Category</Typography>
          <Select
            value={localDetailCat}
            onChange={e => setLocalDetailCat(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 1.5, fontSize: '0.8rem' }}
          >
            {CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
          </Select>
          <Typography sx={{ fontSize: '0.75rem', color: '#6E6E73', mb: 0.5 }}>Form Factor</Typography>
          <Select
            value={localFormFactor}
            onChange={e => setLocalFormFactor(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 2, fontSize: '0.8rem' }}
          >
            {FORM_FACTORS.map(f => <MenuItem key={f} value={f} sx={{ fontSize: '0.8rem' }}>{f}</MenuItem>)}
          </Select>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={() => setAnchorEl(null)} sx={{ color: '#6E6E73', fontSize: '0.75rem' }}>Cancel</Button>
            <Button
              size="small"
              variant="contained"
              onClick={saveDetails}
              disabled={
                localName.trim() === product.name &&
                localDetailCat   === product.category &&
                localFormFactor  === product.formFactor
              }
              sx={{ backgroundColor: '#F47F6B', '&:hover': { backgroundColor: '#e06b57' }, fontSize: '0.75rem' }}
            >
              Save
            </Button>
          </Box>
        </Popover>
      </TableCell>

      {/* Form Factor column — synced with Name popover's form factor field */}
      <TableCell sx={{ minWidth: 130 }}>
        {editingFormFactor ? (
          <Select
            value={product.formFactor}
            defaultOpen
            onChange={e => { onFormFactorChange(product.id, e.target.value); setEditingFormFactor(false) }}
            onClose={() => setEditingFormFactor(false)}
            size="small"
            sx={{ fontSize: '0.8rem', minWidth: 110, '.MuiOutlinedInput-notchedOutline': { borderColor: '#E5E5EA' } }}
          >
            {FORM_FACTORS.map(f => (
              <MenuItem key={f} value={f} sx={{ fontSize: '0.8rem' }}>{f}</MenuItem>
            ))}
          </Select>
        ) : (
          <Typography
            onClick={() => setEditingFormFactor(true)}
            sx={{ fontSize: '0.875rem', cursor: 'pointer', '&:hover': { color: '#F47F6B' } }}
          >
            {product.formFactor}
          </Typography>
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 100 }}>
        {editingTier ? (
          <Select
            value={product.upgradeTier}
            defaultOpen
            onChange={e => { onUpgradeTierChange(product.id, e.target.value); setEditingTier(false) }}
            onClose={() => setEditingTier(false)}
            size="small"
            sx={{ fontSize: '0.8rem', minWidth: 100, '.MuiOutlinedInput-notchedOutline': { borderColor: '#E5E5EA' } }}
          >
            {UPGRADE_TIERS.map(t => (
              <MenuItem key={t} value={t} sx={{ fontSize: '0.8rem' }}>{t}</MenuItem>
            ))}
          </Select>
        ) : (
          <Typography
            onClick={() => setEditingTier(true)}
            sx={{ fontSize: '0.875rem', cursor: 'pointer', '&:hover': { color: '#F47F6B' } }}
          >
            {product.upgradeTier}
          </Typography>
        )}
      </TableCell>

      {/* Age Range cell — between Upgrade Tier and Retail Price */}
      <TableCell sx={{ minWidth: 110 }}>
        {editingAge ? (
          <ClickAwayListener onClickAway={commitAgeAndClose}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Select
                value={localMin}
                defaultOpen
                onChange={e => handleMinChange(Number(e.target.value))}
                onOpen={() => { ageSelectOpen.current = true }}
                onClose={() => { setTimeout(() => { ageSelectOpen.current = false }, 0) }}
                size="small"
                sx={{ fontSize: '0.8rem', minWidth: 54, '.MuiOutlinedInput-notchedOutline': { borderColor: '#E5E5EA' } }}
              >
                {MIN_AGES.map(a => (
                  <MenuItem key={a} value={a} sx={{ fontSize: '0.8rem' }}>{a}</MenuItem>
                ))}
              </Select>
              <Typography sx={{ fontSize: '0.75rem', color: '#6E6E73' }}>–</Typography>
              <Select
                value={localMax}
                onChange={e => handleMaxChange(Number(e.target.value))}
                onOpen={() => { ageSelectOpen.current = true }}
                onClose={() => { setTimeout(() => { ageSelectOpen.current = false }, 0) }}
                size="small"
                sx={{ fontSize: '0.8rem', minWidth: 54, '.MuiOutlinedInput-notchedOutline': { borderColor: '#E5E5EA' } }}
              >
                {MAX_AGES.filter(m => m > localMin).map(a => (
                  <MenuItem key={a} value={a} sx={{ fontSize: '0.8rem' }}>{a}</MenuItem>
                ))}
              </Select>
            </Box>
          </ClickAwayListener>
        ) : (
          <Typography
            onClick={() => setEditingAge(true)}
            sx={{ fontSize: '0.875rem', cursor: 'pointer', '&:hover': { color: '#F47F6B' } }}
          >
            {product.minAge}–{product.maxAge}
          </Typography>
        )}
      </TableCell>

      <TableCell>
        <Box
          onClick={() => onPriceClick(product.id, product.name, product.cost, cogOverhead)}
          sx={{
            cursor: 'pointer',
            color: '#F47F6B',
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          ${product.retailPrice.toFixed(2)}
        </Box>
      </TableCell>

      <TableCell>
        <input
          type="number"
          value={localQty}
          min={0}
          onChange={e => setLocalQty(e.target.value)}
          onBlur={commitQty}
          onKeyDown={handleKeyDown}
          style={{
            width: 72,
            padding: '4px 6px',
            border: '1px solid #E5E5EA',
            borderRadius: 6,
            fontSize: '0.875rem',
            fontFamily: 'inherit',
          }}
        />
      </TableCell>

      <TableCell>
        <Chip
          label={product.active ? 'Active' : 'Inactive'}
          size="small"
          color={product.active ? 'success' : 'default'}
          onClick={() => onActiveToggle(product.id, product.active)}
          sx={{ cursor: 'pointer', minWidth: 72 }}
        />
      </TableCell>

      <TableCell>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onEditAttributes(product.id, product.name)}
          sx={{
            fontSize: '0.75rem',
            py: 0.25,
            borderColor: '#E5E5EA',
            color: '#6E6E73',
            '&:hover': { borderColor: '#F47F6B', color: '#F47F6B' },
          }}
        >
          Modify
        </Button>
      </TableCell>

      <TableCell>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onDelete(product.id)}
          sx={{
            fontSize: '0.75rem',
            py: 0.25,
            borderColor: '#ffcdd2',
            color: '#e57373',
            '&:hover': { borderColor: '#e57373', backgroundColor: '#fff5f5' },
          }}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  )
}
