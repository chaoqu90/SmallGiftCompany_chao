/**
 * AdminFuturePartiesPage — lists all future party lead submissions.
 *
 * Admins can:
 *  - View all submissions in a table (AC4.4, AC-FP-B.1, AC-FP-B.2)
 *  - View an already-linked bundle via "View Bundle" (AC-FP-B.3)
 *  - Generate and link a new bundle via CreateBundleForFuturePartyDialog (AC5.1–AC5.7)
 *  - Apply an existing bundle ID via ApplyBundleDialog (AC5.8)
 *  - Send (or re-send) the personalised bundle email (AC6.1–AC6.6)
 *
 * Requirements: R4 (AC4.1–AC4.6), R5 (AC5.1–AC5.8), R6 (AC6.1–AC6.6),
 *               R-FP-B (AC-FP-B.1 – AC-FP-B.5)
 * Design: specs/future-party/design.md §5.2
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LinkIcon from '@mui/icons-material/Link'
import SendIcon from '@mui/icons-material/Send'
import ReplayIcon from '@mui/icons-material/Replay'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { adminApi, type AdminFutureParty } from '../../api/admin'
import { CreateBundleForFuturePartyDialog } from './CreateBundleForFuturePartyDialog'
import { ApplyBundleDialog } from './ApplyBundleDialog'
import { SendEmailModal } from './SendEmailModal'

// ─── Date formatting helpers ──────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return dateFormatter.format(new Date(iso))
}

/** Format a DATE-only string (YYYY-MM-DD) without timezone shift. */
function formatDateOnly(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminFuturePartiesPage() {
  const { authHeader } = useAdminAuth()
  const navigate = useNavigate()

  const [submissions, setSubmissions] = useState<AdminFutureParty[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // Generate bundle dialog (AC5.2)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [selectedRow,        setSelectedRow]         = useState<AdminFutureParty | null>(null)

  // Apply bundle dialog (AC5.8)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [applyRow,        setApplyRow]        = useState<AdminFutureParty | null>(null)

  // Email modal state (AC6.1, AC6.2, AC6.6)
  const [emailModalId, setEmailModalId] = useState<number | null>(null)

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

  // ── onLinked callback from generate dialog — navigate to preview (AC5.4, AC5.6, design §5.7) ──

  function handleLinked(updated: AdminFutureParty) {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s))
    setGenerateDialogOpen(false)
    setSelectedRow(null)
    if (updated.linkedBundlePublicId) {
      navigate(`/admin/bundle-preview/${updated.linkedBundlePublicId}?futurePartyId=${updated.id}`)
    } else {
      setSnackbar('Bundle linked successfully!')
    }
  }

  // ── onApplied callback from apply dialog ──────────────────────────────────

  function handleApplied(updated: AdminFutureParty) {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s))
    setApplyDialogOpen(false)
    setApplyRow(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminNav />

      <Box sx={{ p: { xs: 2, md: 3 } }}>
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

        {/* Table (AC4.4, AC-FP-B.1, AC-FP-B.2) */}
        {!loading && !error && (
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
          <TableContainer component={Paper} variant="outlined" sx={{ minWidth: 600 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Party Date</strong></TableCell>
                  <TableCell><strong>Gender</strong></TableCell>
                  <TableCell><strong>Age</strong></TableCell>
                  <TableCell><strong>Submitted</strong></TableCell>
                  <TableCell><strong>Bundle Sent</strong></TableCell>
                  <TableCell><strong>Bundle ID</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {/* Empty state (AC4.6) */}
                {submissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No future party submissions yet.
                    </TableCell>
                  </TableRow>
                )}

                {submissions.map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.email}
                    </TableCell>
                    <TableCell>{formatDateOnly(row.partyDate)}</TableCell>
                    <TableCell>{row.kidGender}</TableCell>
                    <TableCell>{row.kidAge}</TableCell>
                    <TableCell>{formatDate(row.submittedAt)}</TableCell>
                    <TableCell>{row.bundleSentAt ? formatDate(row.bundleSentAt) : '—'}</TableCell>

                    {/* Bundle ID column (AC-FP-B.1, AC-FP-B.2) */}
                    <TableCell>
                      {row.linkedBundlePublicId
                        ? (
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {row.linkedBundlePublicId}
                          </Typography>
                        )
                        : '—'
                      }
                    </TableCell>

                    {/* Actions column — icon buttons (AC-FP-B.3, AC-FP-B.4, AC-FP-B.5, AC5.1, AC5.8, AC6.1, AC6.2) */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.linkedBundlePublicId !== null ? (
                        <>
                          {/* View Bundle (AC-FP-B.3) */}
                          <Tooltip title="View Bundle">
                            <IconButton
                              size="small"
                              onClick={() =>
                                navigate(`/admin/bundle-preview/${row.linkedBundlePublicId}?futurePartyId=${row.id}`)
                              }
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Send / Re-send (AC6.1, AC6.2) */}
                          <Tooltip title={row.bundleSentAt ? 'Re-send Link' : 'Send Link'}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setEmailModalId(row.id)}
                            >
                              {row.bundleSentAt ? <ReplayIcon fontSize="small" /> : <SendIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          {/* Generate Bundle (AC5.1, AC-FP-B.4) */}
                          <Tooltip title="Generate Bundle">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedRow(row)
                                setGenerateDialogOpen(true)
                              }}
                            >
                              <AutoAwesomeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Apply Bundle (AC5.8, AC-FP-B.4) */}
                          <Tooltip title="Apply Existing Bundle">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setApplyRow(row)
                                setApplyDialogOpen(true)
                              }}
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}

                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        )}
      </Box>

      {/* Bundle generation dialog (AC5.2–AC5.7) */}
      <CreateBundleForFuturePartyDialog
        open={generateDialogOpen}
        submission={selectedRow}
        authHeader={authHeader ?? ''}
        onClose={() => { setGenerateDialogOpen(false); setSelectedRow(null) }}
        onLinked={handleLinked}
      />

      {/* Apply existing bundle dialog (AC5.8) */}
      <ApplyBundleDialog
        open={applyDialogOpen}
        submission={applyRow}
        authHeader={authHeader ?? ''}
        onClose={() => { setApplyDialogOpen(false); setApplyRow(null) }}
        onApplied={handleApplied}
      />

      {/* Email compose modal (AC6.1, AC6.2, AC6.3) */}
      <SendEmailModal
        open={emailModalId !== null}
        futurePartyId={emailModalId}
        authHeader={authHeader ?? ''}
        onClose={() => setEmailModalId(null)}
        onSent={(sentAt) => {
          if (emailModalId !== null) {
            setSubmissions(prev => prev.map(s =>
              s.id === emailModalId ? { ...s, bundleSentAt: sentAt } : s,
            ))
          }
          setEmailModalId(null)
          setSnackbar('Email sent successfully!')
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
