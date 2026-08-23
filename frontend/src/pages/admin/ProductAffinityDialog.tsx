import { useEffect, useState } from 'react'
import {
  Box, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Stack, Typography,
} from '@mui/material'
import { adminApi } from '../../api/admin'
import type { ProductAffinities } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

const INTERESTS = ['POP_MUSIC', 'TOYS_PLAY', 'CUTE_MAGICAL', 'SPORTS', 'READING_PUZZLE']
const AUDIENCES = ['FEMININE', 'MASCULINE', 'UNIVERSAL']
const ROLES     = ['UTILITY', 'ACTIVITY', 'PLAY', 'WEARABLE', 'TACTILE', 'NOVELTY', 'COLLECTIBLE']
const OCCASIONS = ['CELEBRATION', 'HALLOWEEN']

interface Props {
  productId: number | null   // null = dialog closed
  productName: string
  onClose: () => void
}

export function ProductAffinityDialog({ productId, productName, onClose }: Props) {
  const { authHeader } = useAdminAuth()
  const open = productId !== null

  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [interests, setInterests] = useState<Record<string, number>>({})
  const [audiences, setAudiences] = useState<Record<string, number>>({})
  const [roles,     setRoles]     = useState<Record<string, number>>({})
  const [occasions, setOccasions] = useState<Set<string>>(new Set())

  // Snapshot of what was loaded from the server — used to detect changes
  const [origInterests, setOrigInterests] = useState<Record<string, number>>({})
  const [origAudiences, setOrigAudiences] = useState<Record<string, number>>({})
  const [origRoles,     setOrigRoles]     = useState<Record<string, number>>({})
  const [origOccasions, setOrigOccasions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !authHeader || productId === null) return
    setLoading(true)
    setError(null)
    adminApi.getAffinities(authHeader, productId)
      .then(data => {
        const iw = data.interestWeights ?? {}
        const aw = data.audienceWeights ?? {}
        const rw = data.roleWeights ?? {}
        const oc = new Set(data.occasions ?? [])
        setInterests(iw);  setOrigInterests(iw)
        setAudiences(aw);  setOrigAudiences(aw)
        setRoles(rw);      setOrigRoles(rw)
        setOccasions(oc);  setOrigOccasions(oc)
      })
      .catch(() => setError('Failed to load attributes'))
      .finally(() => setLoading(false))
  }, [open, productId, authHeader])

  function recordsEqual(a: Record<string, number>, b: Record<string, number>, keys: string[]) {
    return keys.every(k => (a[k] ?? 0) === (b[k] ?? 0))
  }

  function setsEqual(a: Set<string>, b: Set<string>) {
    if (a.size !== b.size) return false
    for (const v of a) if (!b.has(v)) return false
    return true
  }

  const hasChanges =
    !recordsEqual(interests, origInterests, INTERESTS) ||
    !recordsEqual(audiences, origAudiences, AUDIENCES) ||
    !recordsEqual(roles,     origRoles,     ROLES)     ||
    !setsEqual(occasions, origOccasions)

  async function handleSave() {
    if (!authHeader || productId === null) return
    setSaving(true)
    setError(null)
    const payload: ProductAffinities = {
      interestWeights: interests,
      audienceWeights: audiences,
      roleWeights:     roles,
      occasions:       Array.from(occasions),
    }
    try {
      await adminApi.updateAffinities(authHeader, productId, payload)
      onClose()
    } catch {
      setError('Failed to save — please try again')
    } finally {
      setSaving(false)
    }
  }

  function setWeight(
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    key: string,
    value: string
  ) {
    const n = parseInt(value, 10)
    setter(prev => ({ ...prev, [key]: isNaN(n) ? 0 : Math.min(100, Math.max(0, n)) }))
  }

  function toggleOccasion(occ: string, checked: boolean) {
    setOccasions(prev => {
      const next = new Set(prev)
      checked ? next.add(occ) : next.delete(occ)
      return next
    })
  }

  const inputStyle: React.CSSProperties = {
    width: 72,
    padding: '4px 6px',
    border: '1px solid #E5E5EA',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    textAlign: 'right',
  }

  function WeightRow({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
        <Typography sx={{ fontSize: '0.875rem', color: '#1D1D1F', fontFamily: 'monospace' }}>{label}</Typography>
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
      </Box>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
        Edit Attributes — {productName}
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Typography sx={{ color: 'error.main', mb: 2, fontSize: '0.875rem' }}>{error}</Typography>
        )}

        {!loading && (
          <Stack spacing={2}>

            <Box>
              <Typography variant="overline" sx={{ color: '#6E6E73', fontWeight: 700 }}>
                Interest Affinities (0–100)
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {INTERESTS.map(key => (
                <WeightRow
                  key={key}
                  label={key}
                  value={interests[key] ?? 0}
                  onChange={v => setWeight(setInterests, key, v)}
                />
              ))}
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: '#6E6E73', fontWeight: 700 }}>
                Audience Affinities (0–100)
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {AUDIENCES.map(key => (
                <WeightRow
                  key={key}
                  label={key}
                  value={audiences[key] ?? 0}
                  onChange={v => setWeight(setAudiences, key, v)}
                />
              ))}
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: '#6E6E73', fontWeight: 700 }}>
                Role Affinities (0–100)
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {ROLES.map(key => (
                <WeightRow
                  key={key}
                  label={key}
                  value={roles[key] ?? 0}
                  onChange={v => setWeight(setRoles, key, v)}
                />
              ))}
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: '#6E6E73', fontWeight: 700 }}>
                Occasions
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Stack direction="row" spacing={2}>
                {OCCASIONS.map(occ => (
                  <FormControlLabel
                    key={occ}
                    label={occ}
                    control={
                      <Checkbox
                        checked={occasions.has(occ)}
                        onChange={e => toggleOccasion(occ, e.target.checked)}
                        size="small"
                      />
                    }
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem', fontFamily: 'monospace' } }}
                  />
                ))}
              </Stack>
            </Box>

          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#6E6E73' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving || !hasChanges}
          sx={{ backgroundColor: '#F47F6B', '&:hover': { backgroundColor: '#e06b57' } }}
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
