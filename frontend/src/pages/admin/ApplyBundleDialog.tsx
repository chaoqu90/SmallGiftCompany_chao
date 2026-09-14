/**
 * ApplyBundleDialog — admin dialog to associate an existing bundle public ID
 * with a future party submission.
 *
 * The admin types in a known bundle number; on submit the dialog calls
 * PATCH /admin/api/future-parties/:id/link-bundle and, on success, notifies
 * the parent page via onApplied so the table row refreshes.
 *
 * Requirements: R5 (AC5.8)
 * Design: specs/future-party/design.md §5.4
 */
import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { adminApi, type AdminFutureParty } from '../../api/admin'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open:       boolean
  submission: AdminFutureParty | null
  authHeader: string
  onClose:    () => void
  onApplied:  (updated: AdminFutureParty) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApplyBundleDialog({ open, submission, authHeader, onClose, onApplied }: Props) {
  const [bundlePublicId, setBundlePublicId] = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  function handleClose() {
    if (submitting) return
    setBundlePublicId('')
    setError(null)
    onClose()
  }

  async function handleSubmit() {
    if (!submission) return

    const trimmed = bundlePublicId.trim()
    if (!trimmed) {
      setError('Please enter a bundle number.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const updated = await adminApi.linkBundleToFutureParty(authHeader, submission.id, trimmed)
      setBundlePublicId('')
      onApplied(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!submission) return null

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Apply Existing Bundle</DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Enter the bundle number to associate with this submission.
          </Typography>

          <TextField
            label="Bundle Number"
            fullWidth
            value={bundlePublicId}
            onChange={e => setBundlePublicId(e.target.value)}
            disabled={submitting}
            size="small"
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || bundlePublicId.trim() === ''}
        >
          {submitting
            ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Applying…</>
            : 'Apply'
          }
        </Button>
      </DialogActions>
    </Dialog>
  )
}
