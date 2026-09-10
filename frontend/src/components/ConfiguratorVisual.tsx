import { useMemo } from 'react'
import { Box } from '@mui/material'

// Spec §6–8 — abstract geometric product map.
// Uses SVG only (no Three.js/3D library). Shapes represent physical form factor.
// This visual is supplementary (aria-hidden); item info also appears in text cards.

// ── Shape types ──────────────────────────────────────────────────────────────

type ShapeType = 'BAR' | 'FLAT_RECT' | 'CUBE' | 'ROUND' | 'BAG'

// Each position slot maps to a fixed shape AND the form factor that should fill it.
// Position 0 → BAR shape        → formFactor BAR
// Position 1 → FLAT_RECT shape  → formFactor FLAT_RECT
// Position 2 → CUBE shape       → formFactor IRREGULAR_VOLUME
// Position 3 → ROUND shape      → formFactor SMALL_VOLUME
const SLOTS: { shape: ShapeType; formFactor: string }[] = [
  { shape: 'BAR',       formFactor: 'BAR' },
  { shape: 'FLAT_RECT', formFactor: 'FLAT_RECT' },
  { shape: 'CUBE',      formFactor: 'IRREGULAR_VOLUME' },
  { shape: 'ROUND',     formFactor: 'SMALL_VOLUME' },
]

// Neutral editorial fills (spec §7 — soft neutrals, no rainbow coding)
const FILL: Record<ShapeType, string> = {
  BAR:       '#C8B8A0',   // warm tan
  FLAT_RECT: '#B4CDB8',   // soft sage
  CUBE:      '#B8CCDB',   // dusty blue
  ROUND:     '#C4B8D0',   // soft lavender
  BAG:       '#E8D4C0',   // warm peach
}

// Positions within 400×320 viewBox (matches spec §6 ASCII layout)
const ITEM_POS = [
  { x: 95,  y: 80  },   // top-left
  { x: 280, y: 80  },   // top-right
  { x: 188, y: 185 },   // center
  { x: 95,  y: 268 },   // bottom-left
]
const BAG_POS = { x: 285, y: 260 }

// ── Individual shape renderers ───────────────────────────────────────────────

interface ShapeProps {
  type: ShapeType
  x: number
  y: number
  highlighted: boolean
  dimmed: boolean
  reducedMotion: boolean
  onClick?: () => void
}

function Shape({ type, x, y, highlighted, dimmed, reducedMotion, onClick }: ShapeProps) {
  const fill        = FILL[type]
  const opacity     = dimmed ? 0.45 : 1
  const strokeColor = highlighted ? '#4A6FA5' : 'none'
  const strokeW     = highlighted ? 2.5 : 0
  const transition  = reducedMotion ? undefined : 'opacity 200ms ease, transform 200ms ease'

  const baseStyle: React.CSSProperties = {
    opacity,
    transition,
    transform: highlighted ? 'scale(1.05)' : undefined,
    transformBox:    'fill-box',
    transformOrigin: 'center',
    cursor: onClick ? 'pointer' : 'default',
  }

  const sharedProps = {
    fill,
    stroke:      strokeColor,
    strokeWidth: strokeW,
    style:       baseStyle,
    onClick,
    role:        onClick ? ('button' as const) : undefined,
  }

  if (type === 'BAR') {
    return <rect {...sharedProps} x={x - 10} y={y - 44} width={20} height={88} rx={10} />
  }
  if (type === 'FLAT_RECT') {
    return <rect {...sharedProps} x={x - 40} y={y - 28} width={80} height={56} rx={7} />
  }
  if (type === 'CUBE') {
    return <rect {...sharedProps} x={x - 32} y={y - 32} width={64} height={64} rx={9} />
  }
  if (type === 'ROUND') {
    return <ellipse {...sharedProps} cx={x} cy={y} rx={38} ry={32} />
  }
  if (type === 'BAG') {
    return (
      <g style={{ opacity: 0.88 }}>
        <rect fill={fill} x={x - 30} y={y - 26} width={60} height={56} rx={8} />
        <path
          fill="none"
          stroke="#C0A888"
          strokeWidth={3}
          strokeLinecap="round"
          d={`M ${x - 14} ${y - 26} Q ${x - 14} ${y - 46} ${x} ${y - 46} Q ${x + 14} ${y - 46} ${x + 14} ${y - 26}`}
        />
      </g>
    )
  }
  return null
}

// ── ConfiguratorVisual ───────────────────────────────────────────────────────

interface VisualItem {
  sku: string
  formFactor: string
}

interface Props {
  items: VisualItem[]
  highlightedSku: string | null
  onShapeClick: (sku: string) => void
}

export function ConfiguratorVisual({ items, highlightedSku, onShapeClick }: Props) {
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  )

  const anyHighlighted = highlightedSku !== null

  return (
    <Box
      aria-hidden="true"
      sx={{
        backgroundColor: '#F0EDE8',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        aspectRatio: '4 / 3',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 400 320"
        width="100%"
        height="100%"
        style={{ display: 'block', maxHeight: 420 }}
      >
        <defs>
          <filter id="cfg-drop-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx={0} dy={3} stdDeviation={5} floodColor="#00000018" />
          </filter>
        </defs>

        <g filter="url(#cfg-drop-shadow)">
          {SLOTS.map((slot, idx) => {
            const pos = ITEM_POS[idx]
            if (!pos) return null
            // Find the item whose formFactor matches this slot
            const item = items.find(i => i.formFactor === slot.formFactor)
            const sku = item?.sku ?? null
            return (
              <Shape
                key={slot.formFactor}
                type={slot.shape}
                x={pos.x}
                y={pos.y}
                highlighted={sku !== null && highlightedSku === sku}
                dimmed={anyHighlighted && highlightedSku !== sku}
                reducedMotion={reducedMotion}
                onClick={sku ? () => onShapeClick(sku) : undefined}
              />
            )
          })}

          {/* Gift bag — always present, not interactive */}
          <Shape
            type="BAG"
            x={BAG_POS.x}
            y={BAG_POS.y}
            highlighted={false}
            dimmed={false}
            reducedMotion={reducedMotion}
          />
        </g>
      </svg>
    </Box>
  )
}
