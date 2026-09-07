/**
 * AdminRedemptionPage — allows staff to redeem a customer's promotion code
 * by entering the 6-digit code from their email.
 *
 * Route: /admin/redemption
 */
import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { AdminNav } from './AdminNav'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { adminApi, type AdminFutureParty } from '../../api/admin'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the HTTP status number from the error message emitted by adminRequest.
 * adminRequest throws `new Error(`Request failed: ${res.status}`)` for non-ok
 * responses, so we parse the trailing number.
 */
function parseErrorStatus(err: unknown): number | null {
  if (!(err instanceof Error)) return null
  const match = /Request failed: (\d+)/.exec(err.message)
  return match ? parseInt(match[1], 10) : null
}

function errorMessage(err: unknown): string {
  const status = parseErrorStatus(err)
  if (status === 404) return 'Code not found. Please check and try again.'
  if (status === 409) return 'This code has already been redeemed.'
  return 'Something went wrong. Please try again.'
}

// ─── Component ────────────────────────────────────────────────────────────────

type PageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; party: AdminFutureParty }
  | { kind: 'error'; message: string }

export function AdminRedemptionPage() {
  const { authHeader } = useAdminAuth()

  const [code,      setCode]      = useState('')
  const [pageState, setPageState] = useState<PageState>({ kind: 'idle' })

  // ── Input handler — digits only, max 6 ──────────────────────────────────────

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    // Clear error when user starts retyping
    if (pageState.kind === 'error') setPageState({ kind: 'idle' })
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleRedeem() {
    if (!authHeader || code.length !== 6) return
    setPageState({ kind: 'loading' })
    try {
      const party = await adminApi.redeemPromotion(authHeader, code)
      setPageState({ kind: 'success', party })
    } catch (err) {
      setPageState({ kind: 'error', message: errorMessage(err) })
    }
  }

  // ── Reset to initial state ───────────────────────────────────────────────────

  function handleRedeemAnother() {
    setCode('')
    setPageState({ kind: 'idle' })
  }

  const isLoading = pageState.kind === 'loading'
  const isSuccess = pageState.kind === 'success'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminNav />

      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <Paper
          variant="outlined"
          sx={{ p: 4, maxWidth: 480, width: '100%' }}
        >
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
            Promotion Redemption
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter the 6-digit code from the customer&apos;s email to redeem their surprise gift.
          </Typography>

          {/* Success state */}
          {isSuccess && pageState.kind === 'success' && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Gift redeemed! Email: {pageState.party.email}, Party Date:{' '}
                {pageState.party.partyDate}, Kid:{' '}
                {pageState.party.kidAge}yo {pageState.party.kidGender}
              </Alert>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleRedeemAnother}
              >
                Redeem Another
              </Button>
            </>
          )}

          {/* Input + submit (shown when not yet successful) */}
          {!isSuccess && (
            <>
              <TextField
                label="Redemption Code"
                placeholder="000000"
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                inputProps={{ maxLength: 6 }}
                fullWidth
                disabled={isLoading}
                sx={{ mb: 2 }}
                InputProps={{
                  sx: { fontSize: '1.5rem', letterSpacing: '0.3em', fontFamily: 'monospace' },
                }}
              />

              {/* Error state */}
              {pageState.kind === 'error' && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {pageState.message}
                </Alert>
              )}

              <Button
                variant="contained"
                color="primary"
                fullWidth
                disabled={isLoading || code.length !== 6}
                onClick={handleRedeem}
                sx={{ py: 1.5 }}
              >
                {isLoading ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  'Redeem Gift'
                )}
              </Button>
            </>
          )}
        </Paper>
      </Box>
    </>
  )
}
