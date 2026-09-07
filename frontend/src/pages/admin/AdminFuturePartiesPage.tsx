/**
 * AdminFuturePartiesPage — lists all future party lead submissions.
 *
 * Admins can:
 *  - View all submissions in a table (AC4.4)
 *  - Generate and link a bundle via CreateBundleForFuturePartyDialog (AC5.1–AC5.7)
 *  - Send (or re-send) the personalised bundle email (AC6.1–AC6.6)
 *
 * Requirements: R4 (AC4.1–AC4.6), R5 (AC5.1–AC5.7), R6 (AC6.1–AC6.6)
 * Design: specs/future-party/design.md §5.2
 */
import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from '@mui/material'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { adminApi, type AdminFutureParty } from '../../api/admin'
import { CreateBundleForFuturePartyDialog } from './CreateBundleForFuturePartyDialog'

// ─── Date formatting helpers ──────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return dateFormatter.format(new Date(iso))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminFuturePartiesPage() {
  const { authHeader } = useAdminAuth()

  const [submissions, setSubmissions] = useState<AdminFutureParty[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // Bundle generation dialog
  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [selectedRow,  setSelectedRow]  = useState<AdminFutureParty | null>(null)

  // Send link state
  const [sendingId,  setSendingId]  = useState<number | null>(null)
  const [sendError,  setSendError]  = useState<{ id: number; msg: string } | null>(null)

  // Success snackbar
  const [snackbar, setSnackbar] = useState<string | null>(null)

  // ── Fetch submissions on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (!authHeader) return
    let cancelled = false
    setLoading(true)
    adminApi.getFutureParties(authHeader)
      .then(data => { if (!cancelled) setSubmissions(data) })
      .catch(() => { if (!cancelled) setError('Failed to load future party submissions.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authHeader])

  // ── Send / Re-send link ────────────────────────────────────────────────────

  async function handleSendLink(id: number) {
    if (!authHeader) return
    setSendingId(id)
    setSendError(null)
    try {
      const { sentAt } = await adminApi.sendFuturePartyLink(authHeader, id)
      setSubmissions(prev => prev.map(s =>
        s.id === id ? { ...s, bundleSentAt: sentAt } : s,
      ))
      setSnackbar('Email sent successfully!')
    } catch {
      setSendError({ id, msg: 'Failed to send email. Please try again.' })
    } finally {
      setSendingId(null)
    }
  }

  // ── onLinked callback from dialog ─────────────────────────────────────────

  function handleLinked(updated: AdminFutureParty) {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s))
    setSnackbar('Bundle linked successfully!')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminNav />

      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
          Future Party Submissions
        </Typography>

        {/* Loading state (AC4.5) */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error state (AC4.5) */}
        {!loading && error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Table (AC4.4) */}
        {!loading && !error && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Party Date</strong></TableCell>
                  <TableCell><strong>Gender</strong></TableCell>
                  <TableCell><strong>Age</strong></TableCell>
                  <TableCell><strong>Submitted</strong></TableCell>
                  <TableCell><strong>Bundle Sent</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {/* Empty state (AC4.6) */}
                {submissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No future party submissions yet.
                    </TableCell>
                  </TableRow>
                )}

                {submissions.map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.email}
                    </TableCell>
                    <TableCell>{row.partyDate}</TableCell>
                    <TableCell>{row.kidGender}</TableCell>
                    <TableCell>{row.kidAge}</TableCell>
                    <TableCell>{formatDate(row.submittedAt)}</TableCell>
                    <TableCell>{row.bundleSentAt ? formatDate(row.bundleSentAt) : '—'}</TableCell>

                    {/* Actions column (AC5.1, AC6.1, AC6.2) */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {row.linkedBundlePublicId === null ? (
                          /* No bundle yet — show Create Bundle button (AC5.1) */
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setSelectedRow(row)
                              setDialogOpen(true)
                            }}
                          >
                            Create Bundle
                          </Button>
                        ) : (
                          /* Bundle linked — show ID chip */
                          <Chip
                            label={row.linkedBundlePublicId}
                            size="small"
                            variant="outlined"
                            color="success"
                          />
                        )}

                        {/* Send / Re-send (AC6.1, AC6.2) */}
                        {row.linkedBundlePublicId !== null && (
                          <>
                            {row.bundleSentAt && (
                              <Typography variant="caption" color="text.secondary">
                                Sent {formatDate(row.bundleSentAt)}
                              </Typography>
                            )}
                            <Button
                              variant={row.bundleSentAt ? 'outlined' : 'contained'}
                              size="small"
                              color="primary"
                              disabled={sendingId === row.id}
                              onClick={() => handleSendLink(row.id)}
                            >
                              {sendingId === row.id
                                ? <CircularProgress size={14} color="inherit" />
                                : row.bundleSentAt ? 'Re-send' : 'Send Link'
                              }
                            </Button>
                          </>
                        )}
                      </Box>

                      {/* Per-row send error (AC6.6) */}
                      {sendError?.id === row.id && (
                        <Alert severity="error" sx={{ mt: 0.5, py: 0 }}>
                          {sendError.msg}
                        </Alert>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Bundle generation dialog (AC5.2–AC5.7) */}
      <CreateBundleForFuturePartyDialog
        open={dialogOpen}
        submission={selectedRow}
        authHeader={authHeader ?? ''}
        onClose={() => { setDialogOpen(false); setSelectedRow(null) }}
        onLinked={updated => {
          handleLinked(updated)
          setDialogOpen(false)
          setSelectedRow(null)
        }}
      />

      {/* Success snackbar (AC5.6, AC6.6) */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
