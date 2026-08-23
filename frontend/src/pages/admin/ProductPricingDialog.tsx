import { useEffect, useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Typography,
} from '@mui/material'
import { adminApi } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

interface Props {
  productId:          number | null
  productName:        string
  currentCost:        number
  currentCogOverhead: number
  onClose:  () => void
  onSaved:  (updated: import('../../api/admin').AdminProduct) => void
}

// mirrors V22 formula exactly
function computeRetailPrice(cost: number, cogOverhead: number): number {
  const cog = cost + cogOverhead
  if (cog < 1)  return 0.50
  if (cog < 4)  return Math.round((cog / 2)         * 100) / 100
  if (cog < 10) return Math.round((cog / 3 + 2 / 3) * 100) / 100
  return              Math.round((cog * 0.4)         * 100) / 100
}

export function ProductPricingDialog({
  productId, productName, currentCost, currentCogOverhead, onClose, onSaved,
}: Props) {
  const { authHeader } = useAdminAuth()
  const open = productId !== null

  const [cost,        setCost]        = useState(String(currentCost))
  const [cogOverhead, setCogOverhead] = useState(String(currentCogOverhead))
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // reset inputs when dialog opens for a different product
  useEffect(() => {
    if (open) {
      setCost(String(currentCost))
      setCogOverhead(String(currentCogOverhead))
      setError(null)
    }
  }, [open, currentCost, currentCogOverhead])

  const costNum       = parseFloat(cost)        || 0
  const overheadNum   = parseFloat(cogOverhead) || 0
  const previewRetail = computeRetailPrice(costNum, overheadNum)
  const hasChanges    = costNum !== currentCost || overheadNum !== currentCogOverhead

  async function handleSave() {
    if (!authHeader || productId === null) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminApi.updatePricing(authHeader, productId, costNum, overheadNum)
      onSaved(updated)
      onClose()
    } catch {
      setError('Failed to save pricing')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #E5E5EA',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
        Edit Pricing — {productName}
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Typography sx={{ color: 'error.main', mb: 2, fontSize: '0.875rem' }}>{error}</Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', mb: 0.5 }}>COG Raw (cost)</Typography>
            <input
              type="number"
              min={0}
              step={0.01}
              value={cost}
              onChange={e => setCost(e.target.value)}
              style={inputStyle}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', mb: 0.5 }}>COG Overhead</Typography>
            <input
              type="number"
              min={0}
              step={0.01}
              value={cogOverhead}
              onChange={e => setCogOverhead(e.target.value)}
              style={inputStyle}
            />
          </Box>
          <Box sx={{ pt: 1, borderTop: '1px solid #E5E5EA' }}>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73' }}>
              COG Adjusted: <strong>${(costNum + overheadNum).toFixed(2)}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#F47F6B', mt: 0.5 }}>
              Computed Retail Price: <strong>${previewRetail.toFixed(2)}</strong>
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#6E6E73' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          sx={{ backgroundColor: '#F47F6B', '&:hover': { backgroundColor: '#e06b57' } }}
        >
          {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
