/**
 * CreateBundleForFuturePartyDialog — admin dialog for generating a personalised
 * goodie bag bundle from a future party submission.
 *
 * Flow:
 *  1. Admin selects Interest, Party Type, and Budget Tier.
 *  2. Audience and Age are pre-filled (read-only) from the submission.
 *  3. On submit, POSTs to public /api/generated-bundles (no auth).
 *  4. Then PATCHes /admin/api/future-parties/:id/link-bundle (with admin auth).
 *  5. On success, calls onLinked(updatedRow) and closes.
 *
 * Requirements: AC5.2, AC5.3, AC5.4, AC5.5, AC5.6, AC5.7
 * Design: specs/future-party/design.md §5.3
 */
import { useState } from 'react'
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
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { adminApi, type AdminFutureParty } from '../../api/admin'
import type { Interest, PartyType, AudiencePreference } from '../../types/catalog'
import { COLORS } from '../../theme'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

// ─── Option definitions ───────────────────────────────────────────────────────

const INTEREST_OPTIONS: { value: Interest; label: string }[] = [
  { value: 'POP_MUSIC',      label: 'Pop Music'        },
  { value: 'TOYS_PLAY',      label: 'Toys & Play'      },
  { value: 'CUTE_MAGICAL',   label: 'Cute & Magical'   },
  { value: 'SPORTS',         label: 'Sports'            },
  { value: 'READING_PUZZLE', label: 'Reading & Puzzles' },
]

const PARTY_TYPE_OPTIONS: { value: PartyType; label: string }[] = [
  { value: 'CELEBRATION', label: 'Celebration' },
  { value: 'HALLOWEEN',   label: 'Halloween'   },
]

const BUDGET_OPTIONS: { value: 'LOW' | 'MID' | 'HIGH'; label: string }[] = [
  { value: 'LOW',  label: 'Low'  },
  { value: 'MID',  label: 'Mid'  },
  { value: 'HIGH', label: 'High' },
]

// ─── Gender → audience mapping ────────────────────────────────────────────────

const audienceFromGender: Record<AdminFutureParty['kidGender'], AudiencePreference> = {
  BOY:   'MASCULINE',
  GIRL:  'FEMININE',
  MIXED: 'NO_PREFERENCE',
}

// ─── Reusable chip row ────────────────────────────────────────────────────────

interface ChipRowProps<T extends string> {
  options:    { value: T; label: string }[]
  selected:   T | null
  onSelect:   (v: T) => void
  disabled?:  boolean
}

function ChipRow<T extends string>({ options, selected, onSelect, disabled }: ChipRowProps<T>) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
      {options.map(({ value, label }) => {
        const isSelected = selected === value
        return (
          <Chip
            key={value}
            label={label}
            onClick={() => !disabled && onSelect(value)}
            variant={isSelected ? 'filled' : 'outlined'}
            color={isSelected ? 'primary' : 'default'}
            sx={{
              borderColor: isSelected ? undefined : COLORS.border,
              cursor: disabled ? 'default' : 'pointer',
            }}
          />
        )
      })}
    </Stack>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open:        boolean
  submission:  AdminFutureParty | null
  authHeader:  string
  onClose:     () => void
  onLinked:    (updated: AdminFutureParty) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateBundleForFuturePartyDialog({
  open, submission, authHeader, onClose, onLinked,
}: Props) {
  const [interest,   setInterest]   = useState<Interest | null>(null)
  const [partyType,  setPartyType]  = useState<PartyType | null>(null)
  const [budgetTier, setBudgetTier] = useState<'LOW' | 'MID' | 'HIGH' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [interestError,   setInterestError]   = useState<string | null>(null)
  const [partyTypeError,  setPartyTypeError]  = useState<string | null>(null)
  const [budgetTierError, setBudgetTierError] = useState<string | null>(null)

  function handleClose() {
    if (submitting) return
    // Reset state on close
    setInterest(null)
    setPartyType(null)
    setBudgetTier(null)
    setError(null)
    setInterestError(null)
    setPartyTypeError(null)
    setBudgetTierError(null)
    onClose()
  }

  async function handleSubmit() {
    if (!submission) return

    // 1. Validation (AC5.3)
    let hasError = false
    if (!interest)   { setInterestError('Please select an interest.');     hasError = true }
    else              { setInterestError(null) }
    if (!partyType)  { setPartyTypeError('Please select a party type.');   hasError = true }
    else              { setPartyTypeError(null) }
    if (!budgetTier) { setBudgetTierError('Please select a budget tier.'); hasError = true }
    else              { setBudgetTierError(null) }
    if (hasError) return

    setSubmitting(true)
    setError(null)

    try {
      const audiencePreference = audienceFromGender[submission.kidGender]
      // Clamp age to the bundle engine's accepted range 3–12 (design.md §5.3)
      const age = Math.min(12, Math.max(3, submission.kidAge))

      // 2. Generate bundle via public endpoint (no admin auth — AC5.4)
      const genRes = await fetch(`${BASE_URL}/api/generated-bundles`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age,
          audiencePreference,
          interest,
          partyType,
          budgetTierCode: budgetTier,
          maxRetailPrice: null,
        }),
      })
      if (!genRes.ok) throw new Error(`Bundle generation failed: ${genRes.status}`)
      const genData = await genRes.json() as { generatedBundleId: string }

      // 3. Link bundle to the submission via admin endpoint (AC5.4, AC5.5)
      const updated = await adminApi.linkBundleToFutureParty(
        authHeader,
        submission.id,
        genData.generatedBundleId,
      )

      // 4. Success — notify parent and close (AC5.6)
      onLinked(updated)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!submission) return null

  const audienceLabel = audienceFromGender[submission.kidGender]

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Bundle for Future Party</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Read-only submission summary */}
          <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Email:</strong> {submission.email}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Party Date:</strong> {submission.partyDate}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Kid Gender:</strong> {submission.kidGender}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Kid Age:</strong> {submission.kidAge}
            </Typography>
          </Box>

          <Divider />

          {/* Interest */}
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
              Interest
            </Typography>
            <ChipRow
              options={INTEREST_OPTIONS}
              selected={interest}
              onSelect={setInterest}
              disabled={submitting}
            />
            {interestError && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {interestError}
              </Typography>
            )}
          </Box>

          {/* Party Type */}
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
              Party Type
            </Typography>
            <ChipRow
              options={PARTY_TYPE_OPTIONS}
              selected={partyType}
              onSelect={setPartyType}
              disabled={submitting}
            />
            {partyTypeError && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {partyTypeError}
              </Typography>
            )}
          </Box>

          {/* Budget Tier */}
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
              Budget Tier
            </Typography>
            <ChipRow
              options={BUDGET_OPTIONS}
              selected={budgetTier}
              onSelect={setBudgetTier}
              disabled={submitting}
            />
            {budgetTierError && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {budgetTierError}
              </Typography>
            )}
          </Box>

          {/* Read-only derived fields */}
          <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Audience (derived):</strong> {audienceLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Age (pre-filled):</strong> {submission.kidAge}
              {submission.kidAge < 3 ? ' (clamped to 3 for bundle engine)' : ''}
            </Typography>
          </Box>

          {/* API error (AC5.7) */}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          sx={{ backgroundColor: COLORS.coral, '&:hover': { backgroundColor: '#e06b57' } }}
        >
          {submitting
            ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Generating…</>
            : 'Generate & Link'
          }
        </Button>
      </DialogActions>
    </Dialog>
  )
}
