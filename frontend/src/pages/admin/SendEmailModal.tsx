/**
 * SendEmailModal
 *
 * Pre-populates the future-party bundle email from the server template,
 * lets the admin edit subject, body, and add extra recipients, then sends.
 *
 * Props:
 *   open            — controls Dialog visibility
 *   futurePartyId   — numeric ID of the future party submission
 *   authHeader      — Basic auth header string
 *   onClose()       — called when modal is dismissed without sending
 *   onSent(sentAt)  — called after successful send with the sentAt timestamp
 */
import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { adminApi } from '../../api/admin'

interface Props {
  open:          boolean
  futurePartyId: number | null
  authHeader:    string
  onClose:       () => void
  onSent:        (sentAt: string) => void
}

export function SendEmailModal({ open, futurePartyId, authHeader, onClose, onSent }: Props) {
  // Preview load state
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError,   setPreviewError]   = useState<string | null>(null)

  // Editable fields
  const [toEmail,         setToEmail]         = useState('')
  const [extraRecipients, setExtraRecipients] = useState<string[]>([])
  const [ccInput,         setCcInput]         = useState('')
  const [ccError,         setCcError]         = useState<string | null>(null)
  const [subject,         setSubject]         = useState('')
  const [textBody,        setTextBody]        = useState('')

  // Send state
  const [sending,   setSending]   = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Load preview when modal opens
  useEffect(() => {
    if (!open || futurePartyId === null || !authHeader) return
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    setSendError(null)
    setExtraRecipients([])
    setCcInput('')
    setCcError(null)
    adminApi.getEmailPreview(authHeader, futurePartyId)
      .then(data => {
        if (cancelled) return
        setToEmail(data.toEmail)
        setSubject(data.subject)
        setTextBody(data.textBody)
      })
      .catch(() => {
        if (!cancelled) setPreviewError('Failed to load email preview.')
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [open, futurePartyId, authHeader])

  function addCcRecipient() {
    const email = ccInput.trim()
    if (!email) return
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) { setCcError('Enter a valid email address.'); return }
    if (extraRecipients.includes(email)) { setCcError('Already added.'); return }
    setExtraRecipients(prev => [...prev, email])
    setCcInput('')
    setCcError(null)
  }

  function removeCcRecipient(email: string) {
    setExtraRecipients(prev => prev.filter(e => e !== email))
  }

  async function handleSend() {
    if (!authHeader || futurePartyId === null) return
    setSending(true)
    setSendError(null)
    try {
      const { sentAt } = await adminApi.sendFuturePartyLink(authHeader, futurePartyId, {
        extraRecipients: extraRecipients.length > 0 ? extraRecipients : undefined,
        subject,
        textBody,
      })
      onSent(sentAt)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Send Bundle Link
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {previewLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {previewError && !previewLoading && (
          <Alert severity="error">{previewError}</Alert>
        )}

        {!previewLoading && !previewError && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Primary recipient — read only */}
            <TextField
              label="To"
              value={toEmail}
              size="small"
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Primary recipient — cannot be changed"
            />

            {/* Extra recipients (CC) */}
            <Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Add recipient"
                  value={ccInput}
                  size="small"
                  fullWidth
                  placeholder="additional@email.com"
                  onChange={e => { setCcInput(e.target.value); setCcError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCcRecipient() } }}
                  error={!!ccError}
                  helperText={ccError ?? ' '}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={addCcRecipient}
                  sx={{ mt: 0.5, flexShrink: 0, alignSelf: 'flex-start' }}
                >
                  Add
                </Button>
              </Box>
              {extraRecipients.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {extraRecipients.map(e => (
                    <Chip
                      key={e}
                      label={e}
                      size="small"
                      onDelete={() => removeCcRecipient(e)}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Subject */}
            <TextField
              label="Subject"
              value={subject}
              size="small"
              fullWidth
              onChange={e => setSubject(e.target.value)}
            />

            {/* Body */}
            <TextField
              label="Message (plain text)"
              value={textBody}
              multiline
              minRows={8}
              maxRows={16}
              fullWidth
              size="small"
              onChange={e => setTextBody(e.target.value)}
              helperText="The HTML email will use the standard branded template. This text appears as the plain-text fallback."
            />

            {sendError && <Alert severity="error">{sendError}</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || previewLoading || !!previewError || !subject.trim() || !textBody.trim()}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {sending ? 'Sending\u2026' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

