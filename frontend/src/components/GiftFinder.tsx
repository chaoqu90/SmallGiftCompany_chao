import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '../api/analytics'
import {
  Box, Button, Chip, CircularProgress, Slider, Stack, Typography,
} from '@mui/material'
import { generateBundle } from '../api/generatedBundles'
import type { Interest, AudiencePreference, PartyType, BudgetTierCode } from '../types/catalog'
import { COLORS } from '../theme'

// ── Price slider bounds (computed from actual total bundle retail prices) ─────
// Min: 4 × $0.50 cheapest items + $0.50 standard upgrade = $2.50  → floor $3
// Max: 4 most expensive STANDARD items ($9.83) + PREMIUM upgrade ($10.00) ≈ $20

const PRICE_MIN = 3
const PRICE_MAX = 20

function priceToTier(max: number): BudgetTierCode {
  if (max <= 8)  return 'LOW'
  if (max <= 15) return 'MID'
  return 'HIGH'
}

// ── Option definitions ───────────────────────────────────────────────────────

const AGE_OPTIONS = [
  { value: 4,  label: '3–5'  },
  { value: 7,  label: '6–8'  },
  { value: 10, label: '9–12' },
]

const INTEREST_OPTIONS: { value: Interest; label: string }[] = [
  { value: 'POP_MUSIC',      label: '🎵 Pop Music'        },
  { value: 'TOYS_PLAY',      label: '🧸 Toys & Play'      },
  { value: 'CUTE_MAGICAL',   label: '✨ Cute & Magical'   },
  { value: 'SPORTS',         label: '⚽ Sports'            },
  { value: 'READING_PUZZLE', label: '📚 Reading & Puzzles' },
]

const AUDIENCE_OPTIONS: { value: AudiencePreference; label: string }[] = [
  { value: 'FEMININE',      label: 'Girl'           },
  { value: 'MASCULINE',     label: 'Boy'            },
  { value: 'NO_PREFERENCE', label: 'No Preference'  },
]

const PARTY_OPTIONS: { value: PartyType; label: string }[] = [
  { value: 'CELEBRATION', label: '🎉 Celebration' },
  { value: 'HALLOWEEN',   label: '🎃 Halloween'   },
]

// ── Shared chip row ──────────────────────────────────────────────────────────

interface ChipRowProps<T extends string | number> {
  options: { value: T; label: string }[]
  selected: T | null
  onSelect: (value: T) => void
}

function ChipRow<T extends string | number>({ options, selected, onSelect }: ChipRowProps<T>) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
      {options.map(({ value, label }) => {
        const isSelected = selected === value
        return (
          <Chip
            key={String(value)}
            label={label}
            onClick={() => onSelect(value)}
            variant={isSelected ? 'filled' : 'outlined'}
            color={isSelected ? 'primary' : 'default'}
            sx={{
              borderColor: isSelected ? undefined : COLORS.border,
              transform: isSelected ? 'scale(1.01)' : 'none',
              cursor: 'pointer',
              minHeight: 36,
            }}
          />
        )
      })}
    </Stack>
  )
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      component="p"
      sx={{ color: COLORS.muted, fontWeight: 600, mb: 1, mt: 2, fontSize: '0.8rem' }}
    >
      {children}
    </Typography>
  )
}

// ── Session persistence key ──────────────────────────────────────────────────

const SESSION_KEY = 'giftFinderSelections'

interface SavedSelections {
  age:               number | null
  interest:          Interest | null
  audiencePreference: AudiencePreference | null
  partyType:         PartyType | null
  maxPrice:          number
}

function loadSelections(): SavedSelections {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as SavedSelections
  } catch { /* ignore */ }
  return { age: null, interest: null, audiencePreference: null, partyType: null, maxPrice: PRICE_MAX }
}

function saveSelections(s: SavedSelections) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// ── GiftFinder ───────────────────────────────────────────────────────────────

export function GiftFinder() {
  const navigate = useNavigate()

  const saved = loadSelections()
  const [age,                setAge]                = useState<number | null>(saved.age)
  const [interest,           setInterest]           = useState<Interest | null>(saved.interest)
  const [audiencePreference, setAudiencePreference] = useState<AudiencePreference | null>(saved.audiencePreference)
  const [partyType,          setPartyType]          = useState<PartyType | null>(saved.partyType)
  const [maxPrice,           setMaxPrice]           = useState<number>(saved.maxPrice ?? PRICE_MAX)
  const [submitting,         setSubmitting]         = useState(false)
  const [submitError,        setSubmitError]        = useState<string | null>(null)

  async function handleSubmit() {
    if (!age || !interest) {
      setSubmitError('Please select an age range and an interest.')
      return
    }

    saveSelections({ age, interest, audiencePreference, partyType, maxPrice })

    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await generateBundle({
        age,
        interest,
        audiencePreference: audiencePreference ?? 'NO_PREFERENCE',
        partyType:          partyType          ?? 'CELEBRATION',
        budgetTierCode:     priceToTier(maxPrice),
        maxRetailPrice:     maxPrice >= PRICE_MAX ? null : maxPrice,
      })
      navigate(`/bundleCustomization/${response.generatedBundleId}`)
      trackEvent({ eventType: 'FINDER_COMPLETED', bundleId: response.generatedBundleId })
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasAnySelection = age !== null || interest !== null || audiencePreference !== null
    || partyType !== null || maxPrice < PRICE_MAX

  function handleClearAll() {
    setAge(null)
    setInterest(null)
    setAudiencePreference(null)
    setPartyType(null)
    setMaxPrice(PRICE_MAX)
    setSubmitError(null)
    saveSelections({ age: null, interest: null, audiencePreference: null, partyType: null, maxPrice: PRICE_MAX })
  }

  return (
    <Box
      sx={{
        backgroundColor: '#FFFFFF',
        borderRadius: '22px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        p: { xs: 3, sm: 4 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="h6" component="h2" sx={{ color: COLORS.charcoal }}>
          Let's find their favorites ✨
        </Typography>
        {hasAnySelection && (
          <Box
            component="button"
            onClick={handleClearAll}
            sx={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: COLORS.muted,
              fontSize: '0.75rem',
              fontWeight: 500,
              fontFamily: '"DM Sans", Inter, sans-serif',
              px: 1,
              py: 0.25,
              borderRadius: '6px',
              flexShrink: 0,
              ml: 2,
              '&:hover': { color: COLORS.coral, backgroundColor: 'rgba(244,127,107,0.07)' },
              '&:focus-visible': { outline: `2px solid ${COLORS.coral}`, outlineOffset: 2 },
            }}
          >
            Clear all
          </Box>
        )}
      </Box>

      <SectionLabel>① How old are they? <Box component="span" sx={{ color: COLORS.muted, fontSize: '0.75rem', verticalAlign: 'super' }}>*</Box></SectionLabel>
      <ChipRow options={AGE_OPTIONS} selected={age} onSelect={setAge} />

      <SectionLabel>② What are they into? <Box component="span" sx={{ color: COLORS.muted, fontSize: '0.75rem', verticalAlign: 'super' }}>*</Box></SectionLabel>
      <ChipRow options={INTEREST_OPTIONS} selected={interest} onSelect={setInterest} />

      <SectionLabel>③ Girl or boy?</SectionLabel>
      <ChipRow options={AUDIENCE_OPTIONS} selected={audiencePreference} onSelect={setAudiencePreference} />

      <SectionLabel>④ What's the celebration?</SectionLabel>
      <ChipRow options={PARTY_OPTIONS} selected={partyType} onSelect={setPartyType} />

      <SectionLabel>⑤ Budget per guest?</SectionLabel>
      <Box sx={{ px: 1.5, pt: 0.5, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography
          component="span"
          sx={{ color: COLORS.muted, fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          up to
        </Typography>
        {/* Relative wrapper — floating price label sits above the thumb */}
        <Box sx={{ position: 'relative', flex: 1, pt: '22px', pl: 1.5 }}>
          <Typography
            component="span"
            sx={{
              position: 'absolute',
              top: 0,
              left: `${((maxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100}%`,
              transform: 'translateX(-50%)',
              color: COLORS.muted,
              fontSize: '0.72rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            ${maxPrice}
          </Typography>
          <Slider
            value={maxPrice}
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={1}
            onChange={(_, val) => setMaxPrice(val as number)}
            valueLabelDisplay="off"
            aria-label="Max budget per guest"
            sx={{
              color: COLORS.coral,
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
                '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 6px rgba(244,127,107,0.16)' },
              },
              '& .MuiSlider-track': { height: 4 },
              '& .MuiSlider-rail':  { height: 4, opacity: 0.25 },
            }}
          />
        </Box>
      </Box>

      {submitError && (
        <Typography
          role="alert"
          sx={{ color: COLORS.muted, fontSize: '0.875rem', mt: 2 }}
        >
          {submitError}
        </Typography>
      )}

      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={handleSubmit}
        disabled={submitting}
        sx={{
          mt: 3,
          backgroundColor: COLORS.coral,
          '&:hover': { backgroundColor: '#e06b57' },
          fontSize: '1rem',
          py: 1.5,
        }}
      >
        {submitting ? (
          <CircularProgress size={20} sx={{ color: '#fff' }} />
        ) : (
          'Ready, Set, Gift! →'
        )}
      </Button>
    </Box>
  )
}
