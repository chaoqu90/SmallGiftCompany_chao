import { useEffect, useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Select, Stack, Typography,
} from '@mui/material'
import { adminApi } from '../../api/admin'
import type { CreateProductRequest, ProductMeta } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

// Same formula as ProductPricingDialog
function computeRetailPrice(cost: number, cogOverhead: number): number {
  const cog = cost + cogOverhead
  if (cog < 1)  return 0.50
  if (cog < 4)  return Math.round((cog / 2)         * 100) / 100
  if (cog < 10) return Math.round((cog / 3 + 2 / 3) * 100) / 100
  return              Math.round((cog * 0.4)         * 100) / 100
}

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (product: import('../../api/admin').AdminProduct) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #E5E5EA',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
}

export function AddProductDialog({ open, onClose, onCreated }: Props) {
  const { authHeader } = useAdminAuth()
  const [meta,   setMeta]   = useState<ProductMeta | null>(null)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const [sku,         setSku]         = useState('')
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [cost,        setCost]        = useState('0')
  const [cogOverhead, setCogOverhead] = useState('0')
  const [category,    setCategory]    = useState('')
  const [upgradeTier, setUpgradeTier] = useState('')
  const [formFactor,  setFormFactor]  = useState('')
  const [minAge,      setMinAge]      = useState('3')
  const [maxAge,      setMaxAge]      = useState('12')

  useEffect(() => {
    if (open && authHeader && !meta) {
      adminApi.getMeta(authHeader).then(setMeta).catch(() => {})
    }
  }, [open, authHeader, meta])

  // Reset form on open
  useEffect(() => {
    if (open) {
      setSku('')
      setName('')
      setDescription('')
      setCost('0')
      setCogOverhead('0')
      setCategory('')
      setUpgradeTier('')
      setFormFactor('')
      setMinAge('3')
      setMaxAge('12')
      setError(null)
    }
  }, [open])

  const costNum     = parseFloat(cost)        || 0
  const overheadNum = parseFloat(cogOverhead) || 0
  const previewRetail = computeRetailPrice(costNum, overheadNum)

  async function handleSave() {
    if (!authHeader) return
    if (!sku || !name || !category || !upgradeTier || !formFactor) {
      setError('SKU, Name, Category, Upgrade Tier, and Form Factor are required')
      return
    }
    setSaving(true)
    setError(null)
    const data: CreateProductRequest = {
      sku,
      name,
      description: description || '',
      cost: costNum,
      cogOverhead: overheadNum,
      category,
      upgradeTier,
      formFactor,
      minAge: parseInt(minAge) || 3,
      maxAge: parseInt(maxAge) || 12,
    }
    try {
      const created = await adminApi.createProduct(authHeader, data)
      onCreated(created)
      onClose()
    } catch {
      setError('Failed to create product — SKU may already exist')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { fontSize: '0.8rem', color: '#6E6E73', mb: 0.5 }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Add New Product</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Typography sx={{ color: 'error.main', mb: 2, fontSize: '0.875rem' }}>{error}</Typography>
        )}
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={labelStyle}>SKU *</Typography>
            <input
              value={sku}
              onChange={e => setSku(e.target.value)}
              style={inputStyle}
              placeholder="TOY-EXAMPLE-001"
            />
          </Box>
          <Box>
            <Typography sx={labelStyle}>Name *</Typography>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </Box>
          <Box>
            <Typography sx={labelStyle}>Description</Typography>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={inputStyle}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelStyle}>COG Raw *</Typography>
              <input
                type="number"
                min={0}
                step={0.01}
                value={cost}
                onChange={e => setCost(e.target.value)}
                style={inputStyle}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelStyle}>COG Overhead</Typography>
              <input
                type="number"
                min={0}
                step={0.01}
                value={cogOverhead}
                onChange={e => setCogOverhead(e.target.value)}
                style={inputStyle}
              />
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#F47F6B' }}>
            Computed retail price: <strong>${previewRetail.toFixed(2)}</strong>
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelStyle}>Category *</Typography>
              <Select
                value={category}
                onChange={e => setCategory(e.target.value)}
                size="small"
                fullWidth
                displayEmpty
              >
                <MenuItem value="" disabled>Select…</MenuItem>
                {[...(meta?.categories ?? [])].sort().map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelStyle}>Upgrade Tier *</Typography>
              <Select
                value={upgradeTier}
                onChange={e => setUpgradeTier(e.target.value)}
                size="small"
                fullWidth
                displayEmpty
              >
                <MenuItem value="" disabled>Select…</MenuItem>
                {(meta?.upgradeTiers ?? []).map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelStyle}>Form Factor *</Typography>
              <Select
                value={formFactor}
                onChange={e => setFormFactor(e.target.value)}
                size="small"
                fullWidth
                displayEmpty
              >
                <MenuItem value="" disabled>Select…</MenuItem>
                {[...(meta?.formFactors ?? [])].sort().map(f => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelStyle}>Min Age / Max Age</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <input
                  type="number"
                  min={3}
                  max={12}
                  value={minAge}
                  onChange={e => setMinAge(e.target.value)}
                  style={{ ...inputStyle, width: '50%' }}
                />
                <input
                  type="number"
                  min={3}
                  max={12}
                  value={maxAge}
                  onChange={e => setMaxAge(e.target.value)}
                  style={{ ...inputStyle, width: '50%' }}
                />
              </Box>
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#6E6E73' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ backgroundColor: '#F47F6B', '&:hover': { backgroundColor: '#e06b57' } }}
        >
          {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Add Product'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
