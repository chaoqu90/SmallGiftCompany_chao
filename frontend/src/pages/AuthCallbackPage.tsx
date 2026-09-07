/**
 * AuthCallbackPage — handles Supabase PKCE code exchange after email
 * verification links and Google OAuth redirects.
 *
 * On mount:
 *   1. If the URL contains an `error` query param (OAuth cancellation) →
 *      navigate to /login with oauthError state (AC4.4).
 *   2. Otherwise call supabase.auth.exchangeCodeForSession() using the
 *      full search string (which contains the `code` param).
 *   3. On success → navigate to /profile (AC2.2, AC4.3).
 *   4. On failure → show error with a resend button (AC2.3).
 *
 * Shows a loading spinner while the exchange is in progress.
 *
 * Requirements: R2 (AC2.2, AC2.3, AC2.5), R4 (AC4.3, AC4.4)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Paper,
} from '@mui/material'
import { supabase } from '../lib/supabaseClient'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // AC4.4 — OAuth cancellation: Supabase redirects with ?error=...
    if (params.get('error')) {
      navigate('/login', { state: { oauthError: true } })
      return
    }

    // AC2.2 / AC4.3 — exchange the PKCE code for a session
    supabase.auth
      .exchangeCodeForSession(window.location.search)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          // AC2.3 — invalid or expired link
          setError('This verification link is invalid or has expired.')
          return
        }
        navigate('/profile')
      })
  }, [navigate])

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        px={2}
      >
        <Paper elevation={3} sx={{ p: 4, maxWidth: 420, width: '100%' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Please request a new verification link from the sign-up page.
          </Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <CircularProgress />
    </Box>
  )
}
