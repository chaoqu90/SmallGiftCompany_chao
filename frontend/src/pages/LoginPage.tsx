/**
 * LoginPage — email + password sign-in with Google OAuth option.
 *
 * Requirements: R1 (AC1.3), R3 (AC3.1–AC3.5), R4 (AC4.1–AC4.4)
 */
import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Link,
  Paper,
} from '@mui/material'
import { supabase } from '../lib/supabaseClient'

export function LoginPage() {
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  // AC3.4 — email not confirmed: show resend link instead of generic error
  const [pendingVerification, setPendingVerification] = useState(false)

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
    // Supabase redirects the browser; no further action needed here.
  }

  // ── Email + password submit ───────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPendingVerification(false)
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (!authError && data.session) {
      navigate('/profile')
      return
    }

    if (!authError) {
      navigate('/profile')
      return
    }

    // Map Supabase error codes to user-facing messages (AC3.3, AC3.4, AC3.5)
    if (authError.code === 'email_not_confirmed') {
      setPendingVerification(true)
      return
    }

    if (
      authError.code === 'invalid_credentials' ||
      authError.message?.toLowerCase().includes('invalid login credentials')
    ) {
      setError('Invalid email or password.')
      return
    }

    setError('Sign-in failed. Please try again.')
  }

  // ── Resend verification email ─────────────────────────────────────────────

  async function handleResend() {
    await supabase.auth.resend({ type: 'signup', email })
    setError(null)
    setPendingVerification(false)
    setError('Verification email resent. Check your inbox.')
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
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          Sign in
        </Typography>

        {/* Email not confirmed — show resend option (AC3.4) */}
        {pendingVerification && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={handleResend}>
                Resend
              </Button>
            }
          >
            Please verify your email before signing in.
          </Alert>
        )}

        {error && !pendingVerification && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            sx={{ mb: 2 }}
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            sx={{ mb: 3 }}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Box>

        <Typography variant="body2" mt={3} textAlign="center">
          Don&apos;t have an account?{' '}
          <Link component={RouterLink} to="/register">
            Register
          </Link>
        </Typography>
      </Paper>
    </Box>
  )
}
