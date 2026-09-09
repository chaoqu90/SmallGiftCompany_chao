/**
 * EmailVerificationNoticePage — shown when a user is authenticated but has
 * not yet confirmed their email address.
 *
 * Provides:
 *   - A notice explaining that verification is required.
 *   - A "Resend verification email" button (AC2.5).
 *   - A "Sign out" link.
 *
 * Requirements: R2 (AC2.4, AC2.5)
 */
import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  Link,
} from '@mui/material'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export function EmailVerificationNoticePage() {
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  // ── Resend verification email (AC2.5) ─────────────────────────────────────

  async function handleResend() {
    setResendError(null)
    if (!user?.email) return
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
    if (error) {
      setResendError('Could not resend the email. Please try again.')
    } else {
      setResent(true)
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
      px={2}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Verify your email
        </Typography>

        <Typography variant="body1" mb={3}>
          We sent a verification link to <strong>{user?.email}</strong>. Please check your inbox and click the link to activate your account.
        </Typography>

        {resent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Verification email resent. Check your inbox.
          </Alert>
        )}

        {resendError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {resendError}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleResend}
          disabled={resent}
          fullWidth
          sx={{ mb: 2 }}
        >
          Resend verification email
        </Button>

        <Link
          component="button"
          variant="body2"
          onClick={handleSignOut}
          sx={{ display: 'block', textAlign: 'center', mb: 1 }}
        >
          Sign out
        </Link>
        <Link
          component={RouterLink}
          to="/"
          variant="body2"
          sx={{ display: 'block', textAlign: 'center' }}
        >
          Back to Home
        </Link>
      </Paper>
    </Box>
  )
}
