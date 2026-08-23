import { Box, Typography } from '@mui/material'

// Spec §9 — fixed (non-replaceable) item card.
// Clicking highlights the corresponding geometric shape in the visual.

interface Props {
  sku: string
  name: string
  description: string | null
  highlighted: boolean
  onClick: () => void
}

export function IncludedItemCard({ name, description, highlighted, onClick }: Props) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={highlighted}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }}
      sx={{
        border: highlighted
          ? '2px solid #4A6FA5'
          : '1px solid #D2D2D7',
        borderRadius: '14px',
        padding: { xs: '12px 16px', sm: '14px 18px' },
        backgroundColor: highlighted ? '#F0F4FA' : '#FFFFFF',
        cursor: 'pointer',
        outline: 'none',
        transition: 'border-color 150ms ease, background-color 150ms ease',
        '&:focus-visible': { boxShadow: '0 0 0 3px #4A6FA540' },
        '&:hover':         { borderColor: highlighted ? '#4A6FA5' : '#A0A0A8' },
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: '#1D1D1F', mb: 0.25 }}>
        {name}
      </Typography>
      {description && (
        <Typography sx={{ fontSize: '0.875rem', color: '#6E6E73' }}>
          {description}
        </Typography>
      )}
    </Box>
  )
}
