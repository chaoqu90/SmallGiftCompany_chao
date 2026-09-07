import { useEffect, useRef, useState } from 'react'
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

  // Image upload state
  const [imageFile,      setImageFile]      = useState<File | null>(null)
  const [imagePreview,   setImagePreview]   = useState<string | null>(null)
  const [imagePublicUrl, setImagePublicUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError,     setImageError]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setImageFile(null)
      setImagePreview(null)
      setImagePublicUrl(null)
      setImageError(null)
    }
  }, [open])

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !authHeader) return

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file (JPG, PNG, WebP, etc.)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be smaller than 5 MB')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setImagePublicUrl(null)
    setImageError(null)
    setUploadingImage(true)

    try {
      const { presignedUrl, publicUrl } = await adminApi.getImageUploadUrl(authHeader, file.name, file.type)
      await adminApi.uploadImageToS3(presignedUrl, file)
      setImagePublicUrl(publicUrl)
    } catch {
      setImageError('Image upload failed — product can still be saved without an image')
      setImageFile(null)
      setImagePreview(null)
    } finally {
      setUploadingImage(false)
    }
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    setImagePublicUrl(null)
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
      imageUrl: imagePublicUrl ?? null,
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

          {/* ── Image upload ── */}
          <Box>
            <Typography sx={labelStyle}>Product Image</Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Preview"
                  sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 2, border: '1px solid #E5E5EA', display: 'block' }}
                />
                {uploadingImage && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}
                {!uploadingImage && imagePublicUrl && (
                  <Box sx={{ position: 'absolute', top: 4, right: 4, bgcolor: '#4caf50', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#fff', lineHeight: 1 }}>✓</Typography>
                  </Box>
                )}
                <Button
                  size="small"
                  onClick={handleRemoveImage}
                  sx={{ mt: 0.5, fontSize: '0.7rem', color: '#e57373', p: 0, minWidth: 0, display: 'block' }}
                >
                  Remove
                </Button>
              </Box>
            ) : (
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: 120,
                  height: 120,
                  border: '2px dashed #E5E5EA',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  gap: 0.5,
                  '&:hover': { borderColor: '#F47F6B', bgcolor: '#FFF5F3' },
                }}
              >
                <Typography sx={{ fontSize: '1.5rem' }}>📷</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#AEAEB2', textAlign: 'center', px: 1 }}>
                  Click to upload
                </Typography>
              </Box>
            )}
            {imageError && (
              <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mt: 0.5 }}>{imageError}</Typography>
            )}
          </Box>

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
