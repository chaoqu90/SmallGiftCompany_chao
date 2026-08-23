import { useMemo } from 'react'
import { Box } from '@mui/material'

// Spec §6–8 — abstract geometric product map.
// Uses SVG only (no Three.js/3D library). Shapes represent physical form factor.
// This visual is supplementary (aria-hidden); item info also appears in text cards.

// ── Shape types (spec §6) ────────────────────────────────────────────────────

type ShapeType = 'BAR' | 'FLAT_RECT' | 'CUBE' | 'ROUND' | 'BAG'

// Frontend-only SKU → shape mapping (spec §6: "documented frontend mapping by category/type").
// No backend field is added; this table is the only coupling point.
const SHAPE_BY_SKU: Record<string, ShapeType> = {
  'CRAYON-001':  'BAR',       // crayon → long narrow bar
  'STICKER-001': 'FLAT_RECT', // sticker sheet → flat rectangle
  'PUTTY-001':   'ROUND',     // squishy → rounded blob
}
const FALLBACK_SHAPES: ShapeType[] = ['BAR', 'FLAT_RECT', 'CUBE', 'ROUND']

// Neutral editorial fills (spec §7 — soft neutrals, no rainbow coding)
const FILL: Record<ShapeType, string> = {
  BAR:       '#C8B8A0',   // warm tan — crayon/pencil
  FLAT_RECT: '#B4CDB8',   // soft sage — sticker
  CUBE:      '#B8CCDB',   // dusty blue — toy block
  ROUND:     '#C4B8D0',   // soft lavender — squishy/putty
  BAG:       '#E8D4C0',   // warm peach — gift bag
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
    // transformBox + transformOrigin make CSS transform work correctly on SVG elements
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
    // Long rounded capsule — crayon/pencil (spec §6: "long rounded rectangle / capsule")
    return <rect {...sharedProps} x={x - 10} y={y - 44} width={20} height={88} rx={10} />
  }
  if (type === 'FLAT_RECT') {
    // Wide flat sheet — sticker/card (spec §6: "thin sheet / small rectangle")
    return <rect {...sharedProps} x={x - 40} y={y - 28} width={80} height={56} rx={7} />
  }
  if (type === 'CUBE') {
    // Square block — toy (spec §6: "rounded 3D-ish blob / cube")
    return <rect {...sharedProps} x={x - 32} y={y - 32} width={64} height={64} rx={9} />
  }
  if (type === 'ROUND') {
    // Rounded blob — squishy/putty (spec §6: "sphere-like shape")
    return <ellipse {...sharedProps} cx={x} cy={y} rx={38} ry={32} />
  }
  if (type === 'BAG') {
    // Gift bag — larger container with handle (spec §6: "outlined bag/container shape")
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

interface VisualItem { sku: string }

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
      // Spec §18: visual is supplementary — never the sole source of item info
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
          {items.slice(0, 4).map((item, idx) => {
            const shape = SHAPE_BY_SKU[item.sku] ?? FALLBACK_SHAPES[idx % FALLBACK_SHAPES.length]
            const pos = ITEM_POS[idx]
            if (!pos) return null
            return (
              <Shape
                key={item.sku}
                type={shape}
                x={pos.x}
                y={pos.y}
                highlighted={highlightedSku === item.sku}
                dimmed={anyHighlighted && highlightedSku !== item.sku}
                reducedMotion={reducedMotion}
                onClick={() => onShapeClick(item.sku)}
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
