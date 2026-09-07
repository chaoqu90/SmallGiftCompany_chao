/**
 * ProfilePage — view and edit the authenticated user's display name and phone number.
 *
 * On mount: fetches GET /api/user/profile and populates form state.
 * Email is read-only (sourced from the session, not editable here).
 * PATCH /api/user/profile is called on submit after client-side validation.
 * "Sign out" button calls supabase.auth.signOut() then navigates to /login.
 *
 * Requirements: R6 (AC6.1–AC6.6), R5 (AC5.3)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  FormHelperText,
  Divider,
} from '@mui/material'
import { supabase } from '../lib/supabaseClient'
import { getProfile, updateProfile } from '../lib/userApi'
import { useAuth } from '../contexts/AuthContext'

// E.164 phone: + followed by 1-9, then 6-14 more digits
const E164_REGEX = /^\+[1-9]\d{6,14}$/

export function ProfilePage() {
  const navigate        = useNavigate()
  const { session }     = useAuth()

  const [displayName,  setDisplayName]  = useState('')
  const [phoneNumber,  setPhoneNumber]  = useState('')
  const [loadError,    setLoadError]    = useState<string | null>(null)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [saveSuccess,  setSaveSuccess]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [fetching,     setFetching]     = useState(true)

  // Field-level validation errors
  const [nameError,  setNameError]  = useState('')
  const [phoneError, setPhoneError] = useState('')

  // ── Load profile on mount (AC6.1) ─────────────────────────────────────────

  useEffect(() => {
    if (!session) return
    getProfile(session.access_token)
      .then(profile => {
        setDisplayName(profile.displayName ?? '')
        setPhoneNumber(profile.phoneNumber ?? '')
      })
      .catch(() => setLoadError('Failed to load profile. Please refresh.'))
      .finally(() => setFetching(false))
  }, [session])

  // ── Client-side validation (AC6.5) ───────────────────────────────────────

  function validate(): boolean {
    let valid = true

    if (displayName && displayName.length > 100) {
      setNameError('Display name must be 100 characters or fewer.')
      valid = false
    } else {
      setNameError('')
    }

    if (phoneNumber && !E164_REGEX.test(phoneNumber)) {
      setPhoneError('Phone number must be in E.164 format (e.g. +12125551234).')
      valid = false
    } else {
      setPhoneError('')
    }

    return valid
  }

  // ── Submit (AC6.4, AC6.6) ─────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)

    if (!validate()) return
    if (!session)    return

    setSaving(true)
    try {
      await updateProfile(session.access_token, {
        displayName: displayName || null,
        phoneNumber: phoneNumber || null,
      })
      setSaveSuccess(true)           // AC6.4
    } catch {
      setSaveError('Failed to save profile. Please try again.')  // AC6.6
    } finally {
      setSaving(false)
    }
  }

  // ── Sign out (AC5.3) ──────────────────────────────────────────────────────

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (fetching) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="flex-start"
      minHeight="100vh"
      bgcolor="background.default"
      px={2}
      pt={6}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          Your profile
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Profile updated.
          </Alert>
        )}

        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          {/* Email — read-only (AC6.2) */}
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={session?.user?.email ?? ''}
            InputProps={{ readOnly: true }}
            sx={{ mb: 2 }}
          />

          {/* Display name */}
          <TextField
            label="Display name"
            fullWidth
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            error={!!nameError}
            sx={{ mb: nameError ? 0.5 : 2 }}
            inputProps={{ maxLength: 101 }}
          />
          {nameError && (
            <FormHelperText error sx={{ mb: 1.5 }}>
              {nameError}
            </FormHelperText>
          )}

          {/* Phone number */}
          <TextField
            label="Phone number (E.164, e.g. +12125551234)"
            fullWidth
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            error={!!phoneError}
            sx={{ mb: phoneError ? 0.5 : 3 }}
          />
          {phoneError && (
            <FormHelperText error sx={{ mb: 2 }}>
              {phoneError}
            </FormHelperText>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </Paper>
    </Box>
  )
}
