/**
 * SignupPromotionModal — auto-opens on the /build path to invite visitors
 * to sign up for a surprise gift at the Loudoun Children's Business Fair.
 *
 * Standalone component — NOT a parameterised wrapper around FuturePartyModal.
 * Both components coexist independently so that copy changes to one do not
 * affect the other.
 *
 * Requirements: FEAT-005 R1 (AC1.1–AC1.5), R2 (AC2.1–AC2.9), R3 (AC3.1–AC3.3)
 * Design: specs/signup-promotion/design.md §5
 */
import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import CloseIcon from '@mui/icons-material/Close'
import { submitFutureParty } from '../api/futureParties'
import { COLORS } from '../theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type KidGender = 'BOY' | 'GIRL' | 'MIXED'
type PartyDateRadio = 'within-1m' | '1-3m' | '3-6m'

interface SignupPromotionModalProps {
  open:    boolean
  onClose: () => void
}

// ─── Gender chip options ──────────────────────────────────────────────────────

const GENDER_OPTIONS: { value: KidGender; label: string }[] = [
  { value: 'BOY',   label: 'Boy'           },
  { value: 'GIRL',  label: 'Girl'          },
  { value: 'MIXED', label: 'Mixed / Either' },
]

// ─── Party date radio options ─────────────────────────────────────────────────

const PARTY_DATE_RADIOS: { value: PartyDateRadio; label: string }[] = [
  { value: 'within-1m', label: 'Within 1 month'  },
  { value: '1-3m',      label: '1 – 3 months'    },
  { value: '3-6m',      label: '3 – 6 months'    },
]

/** Returns the first day of the month that falls at the upper bound of the selected radio. */
function resolveRadioDate(radio: PartyDateRadio): string {
  const months = radio === 'within-1m' ? 1 : radio === '1-3m' ? 3 : 6
  return dayjs().add(months, 'month').startOf('month').format('YYYY-MM-DD')
}

// ─── Initial state ────────────────────────────────────────────────────────────

function initialState() {
  return {
    email:           '',
    partyDateRadio:  null as PartyDateRadio | null,
    partyDateManual: '',            // YYYY-MM-DD string from <input type="date">
    kidGender:       null as KidGender | null,
    kidAge:          '' as number | '',
    submitting:      false,
    success:         false,
    apiError:        null as string | null,
    emailError:      null as string | null,
    dateError:       null as string | null,
    genderError:     null as string | null,
    ageError:        null as string | null,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SignupPromotionModal({ open, onClose }: SignupPromotionModalProps) {
  const [state, setState] = useState(initialState())

  const set = (patch: Partial<ReturnType<typeof initialState>>) =>
    setState(prev => ({ ...prev, ...patch }))

  // ── handleClose — AC2.8, AC2.9 ──────────────────────────────────────────────

  function handleClose() {
    if (state.submitting) return   // AC2.9 — guard against close during submission
    setState(initialState())
    onClose()
  }

  // ── handleSubmit — AC2.4, AC2.5 ─────────────────────────────────────────────

  async function handleSubmit() {
    // 1. Clear previous errors
    set({ emailError: null, dateError: null, genderError: null, ageError: null, apiError: null })

    // 2–5. Client-side validation identical to FuturePartyModal (AC2.4)
    let hasError = false

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!state.email || !emailRegex.test(state.email)) {
      set({ emailError: 'Please enter a valid email address.' })
      hasError = true
    }

    // Resolve the final party date string
    let resolvedDate: string | null = null
    if (state.partyDateRadio) {
      resolvedDate = resolveRadioDate(state.partyDateRadio)
    } else if (state.partyDateManual) {
      const parsed = dayjs(state.partyDateManual)
      if (!parsed.isValid() || !parsed.isAfter(dayjs().startOf('day'))) {
        set({ dateError: 'Party date must be a future date.' })
        hasError = true
      } else {
        resolvedDate = state.partyDateManual
      }
    } else {
      set({ dateError: 'Please select a timeframe or enter a specific date.' })
      hasError = true
    }

    if (state.kidGender === null) {
      set({ genderError: 'Please select a gender option.' })
      hasError = true
    }

    const age = Number(state.kidAge)
    if (state.kidAge === '' || !Number.isInteger(age) || age < 1 || age > 12) {
      set({ ageError: 'Please enter an age between 1 and 12.' })
      hasError = true
    }

    if (hasError || !resolvedDate) return

    // 6. Submit with source: 'signup-promotion' (AC4.2)
    set({ submitting: true })
    try {
      await submitFutureParty({
        email:     state.email,
        partyDate: resolvedDate,
        kidGender: state.kidGender!,
        kidAge:    age,
        source:    'signup-promotion',
      })
      // 7. Success (AC2.6)
      set({ success: true })
    } catch {
      // 8. API error (AC2.7)
      set({ apiError: 'Something went wrong. Please try again.' })
    } finally {
      set({ submitting: false })
    }
  }

  // ── today + 1 day string for min date on the native input ─────────────────
  const todayStr = dayjs().add(1, 'day').format('YYYY-MM-DD')

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      {/* AC2.1 — Modal title */}
      <DialogTitle sx={{ pr: 6, color: COLORS.charcoal, fontWeight: 700 }}>
        Welcome to Small Gift Shop!
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {state.success ? (
          /* ── Success state (AC2.6) ────────────────────────────────────────── */
          <Stack spacing={2} sx={{ py: 1 }}>
            <Alert severity="success">
              Thank you! We'll see you at the Loudoun Children's Business Fair on Saturday,
              September 12, 2026. Your surprise gift is waiting for you — check your email for details!
            </Alert>
            <Button variant="outlined" onClick={handleClose} fullWidth>
              Close
            </Button>
          </Stack>
        ) : (
          /* ── Form state ───────────────────────────────────────────────────── */
          <Stack spacing={2.5} sx={{ pt: 1 }}>

            {/* AC2.2 — Welcome message verbatim */}
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
              Small Gift Shop is in early launching stage, and we want to appreciate your support
              by sharing a small gift with you! Sign up with your email address and join us at
              Loudoun Children's Business Fair to receive a surprise gift!
            </Typography>

            {/* AC2.3 field 1 — Email */}
            <TextField
              label="Your email"
              type="email"
              value={state.email}
              onChange={e => set({ email: e.target.value })}
              error={!!state.emailError}
              helperText={state.emailError ?? ''}
              disabled={state.submitting}
              fullWidth
              size="small"
            />

            {/* AC2.3 field 2 — Party date: radio + manual date input */}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
                When is your party?
              </Typography>

              <RadioGroup
                value={state.partyDateRadio ?? ''}
                onChange={e => set({
                  partyDateRadio:  e.target.value as PartyDateRadio,
                  partyDateManual: '',   // clear manual when radio chosen
                  dateError:       null,
                })}
              >
                {PARTY_DATE_RADIOS.map(({ value, label }) => (
                  <FormControlLabel
                    key={value}
                    value={value}
                    control={
                      <Radio
                        size="small"
                        disabled={state.submitting}
                        sx={{ color: COLORS.coral, '&.Mui-checked': { color: COLORS.coral } }}
                      />
                    }
                    label={<Typography variant="body2">{label}</Typography>}
                    sx={{ mb: -0.5 }}
                  />
                ))}
              </RadioGroup>

              {/* Divider label */}
              <Typography variant="caption" sx={{ display: 'block', mt: 1, mb: 0.5, color: 'text.secondary' }}>
                Or enter a specific date
              </Typography>

              {/* Plain date input */}
              <TextField
                type="date"
                size="small"
                value={state.partyDateManual}
                onChange={e => set({
                  partyDateManual: e.target.value,
                  partyDateRadio:  null,   // clear radio when manual date typed
                  dateError:       null,
                })}
                disabled={state.submitting}
                inputProps={{ min: todayStr }}
                sx={{ width: 200 }}
              />

              {state.dateError && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  {state.dateError}
                </Typography>
              )}
            </Box>

            {/* AC2.3 field 3 — Kid gender */}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
                Kid's gender
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                {GENDER_OPTIONS.map(({ value, label }) => {
                  const isSelected = state.kidGender === value
                  return (
                    <Chip
                      key={value}
                      label={label}
                      onClick={() => !state.submitting && set({ kidGender: value })}
                      variant={isSelected ? 'filled' : 'outlined'}
                      color={isSelected ? 'primary' : 'default'}
                      sx={{
                        borderColor: isSelected ? undefined : COLORS.border,
                        cursor: state.submitting ? 'default' : 'pointer',
                      }}
                    />
                  )
                })}
              </Stack>
              {state.genderError && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  {state.genderError}
                </Typography>
              )}
            </Box>

            {/* AC2.3 field 4 — Kid age */}
            <TextField
              label="Kid's age"
              type="number"
              value={state.kidAge}
              onChange={e => {
                const v = e.target.value
                set({ kidAge: v === '' ? '' : Number(v) })
              }}
              error={!!state.ageError}
              helperText={state.ageError ?? ''}
              disabled={state.submitting}
              fullWidth
              size="small"
              inputProps={{ min: 1, max: 12 }}
            />

            {/* API-level error (AC2.7) */}
            {state.apiError && (
              <Alert severity="error">{state.apiError}</Alert>
            )}

            {/* Submit button (AC2.5) */}
            <Button
              variant="contained"
              fullWidth
              onClick={handleSubmit}
              disabled={state.submitting}
              sx={{
                backgroundColor: COLORS.coral,
                '&:hover': { backgroundColor: '#e06b57' },
              }}
            >
              {state.submitting
                ? <CircularProgress size={20} color="inherit" />
                : 'Sign Up and Get My Gift'
              }
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
