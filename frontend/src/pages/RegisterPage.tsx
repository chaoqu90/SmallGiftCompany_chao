/**
 * RegisterPage — email + password registration with Google OAuth option.
 *
 * Requirements: R1 (AC1.1–AC1.5), R4 (AC4.1–AC4.4)
 */
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Link,
  Paper,
  FormHelperText,
} from '@mui/material'
import { supabase } from '../lib/supabaseClient'

export function RegisterPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  // Inline field-level validation errors (AC1.2)
  const [emailError,    setEmailError]    = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError,  setConfirmError]  = useState('')

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
  }

  // ── Client-side validation (AC1.2) ───────────────────────────────────────

  function validate(): boolean {
    let valid = true

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.')
      valid = false
    } else {
      setEmailError('')
    }

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      valid = false
    } else {
      setPasswordError('')
    }

    if (password !== confirm) {
      setConfirmError('Passwords do not match.')
      valid = false
    } else {
      setConfirmError('')
    }

    return valid
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Client-side validation runs before any network call (AC1.2)
    if (!validate()) return

    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (!authError) {
      // AC1.3 — show success message; do NOT navigate
      setSuccess(true)
      return
    }

    // AC1.4 — duplicate email
    if (
      authError.message?.toLowerCase().includes('user already registered') ||
      authError.code === 'user_already_exists'
    ) {
      setError('An account with this email already exists. Try signing in.')
      return
    }

    // AC1.5 — other errors
    setError('Registration failed. Please try again.')
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
          Create account
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Check your inbox for a verification email.
          </Alert>
        )}

        {error && (
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
            error={!!emailError}
            sx={{ mb: emailError ? 0.5 : 2 }}
            autoComplete="email"
          />
          {emailError && (
            <FormHelperText error sx={{ mb: 1.5 }}>
              {emailError}
            </FormHelperText>
          )}

          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={!!passwordError}
            sx={{ mb: passwordError ? 0.5 : 2 }}
            autoComplete="new-password"
          />
          {passwordError && (
            <FormHelperText error sx={{ mb: 1.5 }}>
              {passwordError}
            </FormHelperText>
          )}

          <TextField
            label="Confirm password"
            type="password"
            fullWidth
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            error={!!confirmError}
            sx={{ mb: confirmError ? 0.5 : 3 }}
            autoComplete="new-password"
          />
          {confirmError && (
            <FormHelperText error sx={{ mb: 2 }}>
              {confirmError}
            </FormHelperText>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </Box>

        <Typography variant="body2" mt={3} textAlign="center">
          Already have an account?{' '}
          <Link component={RouterLink} to="/login">
            Sign in
          </Link>
        </Typography>
      </Paper>
    </Box>
  )
}
