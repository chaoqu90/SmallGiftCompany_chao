import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Button, CircularProgress, Container, Dialog, Grid2, MenuItem, Select, Stack, Tooltip, Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { getGeneratedBundle } from '../api/generatedBundles'
import { trackEvent } from '../api/analytics'
import type { GeneratedBundleResponse, GeneratedBundleItemDto } from '../types/catalog'
import { ConfiguratorVisual } from '../components/ConfiguratorVisual'
import { IncludedItemCard }   from '../components/IncludedItemCard'
import { OptionCard }         from '../components/OptionCard'
import { useCart } from '../contexts/CartContext'

// ── Configurator palette (spec §14) ─────────────────────────────────────────

const C = {
  bg:     '#F7F7F5',
  text:   '#1D1D1F',
  meta:   '#6E6E73',
  accent: '#F47F6B',
}

// ── Template code → display name ────────────────────────────────────────────

function bundleDisplayName(templateCode: string): string {
  if (templateCode === 'PRESCHOOL_4_ITEM')     return "Little One's Bundle"
  if (templateCode === 'READING_PUZZLE_4_ITEM') return 'Reading & Puzzle Bundle'
  return 'Your Custom Bundle'
}

// ── BundleCustomizationPage ──────────────────────────────────────────────────

export function BundleCustomizationPage() {
  const { bundleId } = useParams<{ bundleId: string }>()
  const navigate     = useNavigate()
  const { addItem, refreshCart } = useCart()

  const viewTracked = useRef(false)

  const [bundle,    setBundle]    = useState<GeneratedBundleResponse | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [continued, setContinued] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)

  const [highlightedSku,  setHighlightedSku]  = useState<string | null>(null)
  const [lightboxUrl,     setLightboxUrl]     = useState<string | null>(null)
  const [upgradeOptionId, setUpgradeOptionId] = useState<string>('standard')
  const [giftBagOptionId, setGiftBagOptionId] = useState<string>('classic')
  const [quantity,        setQuantity]        = useState<number>(10)

  useEffect(() => {
    if (!bundleId) return

    // Check sessionStorage first — the bundle was just generated and is not yet in DB.
    const cachedJson = sessionStorage.getItem(`bundle:${bundleId}`)
    if (cachedJson) {
      try {
        const parsed = JSON.parse(cachedJson) as GeneratedBundleResponse
        // If cached bundle items are missing imageUrl, discard the cache so we
        // re-fetch from the API which includes the image URLs via JOIN.
        const hasImages = parsed.items.every(item => 'imageUrl' in item)
        if (!hasImages) {
          sessionStorage.removeItem(`bundle:${bundleId}`)
        } else {
          setBundle(parsed)
          setGiftBagOptionId(parsed.giftBag?.code ?? 'classic')
          setLoading(false)
          if (!viewTracked.current) {
            viewTracked.current = true
            trackEvent({ eventType: 'BUNDLE_VIEWED', bundleId })
          }
          return
        }
      } catch {
        // Corrupt cache entry — fall through to API fetch
        sessionStorage.removeItem(`bundle:${bundleId}`)
      }
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    getGeneratedBundle(bundleId)
      .then((b) => {
        if (!cancelled) {
          setBundle(b)
          setGiftBagOptionId(b.giftBag?.code ?? 'classic')
          if (!viewTracked.current) {
            viewTracked.current = true
            trackEvent({ eventType: 'BUNDLE_VIEWED', bundleId: bundleId ?? undefined })
          }
        }
      })
      .catch((e: { message?: string }) => {
        if (!cancelled) setError(e.message ?? 'Bundle not found')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bundleId])

  function handleItemClick(sku: string) {
    setHighlightedSku((prev) => (prev === sku ? null : sku))
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box
        sx={{ backgroundColor: C.bg, minHeight: '100vh', display: 'flex',
          alignItems: 'center', justifyContent: 'center' }}
        data-testid="configurator-loading"
      >
        <Typography sx={{ color: C.meta }}>Loading your goodie bag…</Typography>
      </Box>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !bundle) {
    return (
      <Box sx={{ backgroundColor: C.bg, minHeight: '100vh' }} data-testid="configurator-error">
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography color="error" role="alert" sx={{ mb: 2 }}>
            {error ?? 'Bundle not found'}
          </Typography>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/#finder')}>
            Back to Home
          </Button>
        </Container>
      </Box>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const displayedItems: GeneratedBundleItemDto[] = bundle.items
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const upgradeOptions: { id: string; label: string; description: string; meta: string }[] = []
  if (bundle.upgrade?.standardProductName) {
    upgradeOptions.push({
      id: 'standard',
      label: bundle.upgrade.standardProductName,
      description: 'The included option',
      meta: '',
    })
  } else {
    upgradeOptions.push({ id: 'standard', label: 'Standard', description: 'The original curated set', meta: '' })
  }
  if (bundle.upgrade?.upgradedProductName) {
    const adj = bundle.upgrade.upgradedRetailAdjustment
    const adjLabel = adj != null && adj > 0 ? `+$${adj.toFixed(2)}` : 'Pricing coming soon'
    upgradeOptions.push({
      id: 'upgraded',
      label: bundle.upgrade.upgradedProductName,
      description: 'Premium upgrade',
      meta: adjLabel,
    })
  }

  const giftBagOptions = bundle.giftBag
    ? [{ id: bundle.giftBag.code, label: bundle.giftBag.name, description: 'Ready-to-fill gift bag', meta: 'Included' }]
    : [{ id: 'classic', label: 'Classic Party Bag', description: 'Our standard ready-to-fill gift bag', meta: 'Included' }]

  // Compute the currently displayed retail price:
  //   base (4 fixed items) + standard item (always) + upgrade delta (only when 'upgraded' chosen)
  const basePrice    = bundle.bundleRetailPrice ?? 0
  const standardAdj  = bundle.upgrade?.standardRetailAdjustment ?? 0
  const upgradeAdj   =
    upgradeOptionId === 'upgraded' && bundle.upgrade?.upgradedRetailAdjustment != null
      ? bundle.upgrade.upgradedRetailAdjustment
      : 0
  const displayPrice = basePrice + standardAdj + upgradeAdj

  const totalPrice = displayPrice * quantity

  return (
    <Box sx={{ backgroundColor: C.bg, minHeight: '100vh' }}>

      {/* ── Sticky top bar: Back + per-bag price ────────────────────────── */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E5EA',
          px: { xs: 2, md: 4 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/#finder')}
          sx={{ color: C.meta, minWidth: 0, px: 1 }}
        >
          Back
        </Button>

        {bundle.bundleRetailPrice != null && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ color: C.accent, fontWeight: 700, fontSize: '1.1rem' }}>
                ${displayPrice.toFixed(2)}
              </Typography>
              <Typography sx={{ color: C.meta, fontSize: '0.85rem' }}>/ bag</Typography>
            </Box>
            <Typography sx={{ color: C.meta, fontSize: '0.72rem' }}>One bag per guest</Typography>
          </Box>
        )}
      </Box>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 5, md: 8 } }}>

        <Grid2 container spacing={{ xs: 3, md: 6 }} alignItems="flex-start">

          {/* ── Left column: geometric visual + image gallery ─────────────── */}
          <Grid2
            size={{ xs: 12, md: 6 }}
            sx={{ position: { md: 'sticky' }, top: { md: 72 } }}
          >
            <ConfiguratorVisual
              items={displayedItems.map((item) => ({ sku: item.sku }))}
              highlightedSku={highlightedSku}
              onShapeClick={(sku) => setHighlightedSku((prev) => prev === sku ? null : sku)}
            />

            {/* ── Product image gallery (2 rows × 4 cols) ──────────────────── */}
            {(() => {
              // 4 fixed items + standard upgrade + premium upgrade (no bag slot)
              const gallerySlots: { key: string; label: string; imageUrl: string | null; sku: string | null; included: boolean }[] = [
                ...displayedItems.map(item => ({ key: item.sku, label: item.productName, imageUrl: item.imageUrl, sku: item.sku, included: true })),
                ...(bundle.upgrade?.standardProductName ? [{
                  key: '__standard__',
                  label: bundle.upgrade.standardProductName,
                  imageUrl: bundle.upgrade.standardImageUrl ?? null,
                  sku: bundle.upgrade.standardSku ?? null,
                  included: upgradeOptionId === 'standard',
                }] : []),
                ...(bundle.upgrade?.upgradedProductName ? [{
                  key: '__upgraded__',
                  label: bundle.upgrade.upgradedProductName,
                  imageUrl: bundle.upgrade.upgradedImageUrl ?? null,
                  sku: bundle.upgrade.upgradedSku ?? null,
                  included: upgradeOptionId === 'upgraded',
                }] : []),
              ]

              const hasAnyImage = gallerySlots.some(s => s.imageUrl)
              if (!hasAnyImage) return null

              return (
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {gallerySlots.map((slot) => {
                    const isHighlighted = slot.sku !== null && highlightedSku === slot.sku
                    return (
                      <Tooltip key={slot.key} title={slot.label} placement="top" arrow>
                        <Box
                          onClick={() => {
                            if (slot.sku) handleItemClick(slot.sku)
                            if (slot.imageUrl) setLightboxUrl(slot.imageUrl)
                          }}
                          sx={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: slot.imageUrl ? 'zoom-in' : 'default',
                            border: isHighlighted ? '2.5px solid #4A6FA5' : '2px solid transparent',
                            backgroundColor: '#F0EDE8',
                            transition: 'border-color 150ms ease, box-shadow 150ms ease',
                            boxShadow: isHighlighted ? '0 0 0 3px #4A6FA530' : 'none',
                            '&:hover': { borderColor: slot.imageUrl ? '#A0A0A8' : 'transparent' },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {slot.imageUrl ? (
                            <Box
                              component="img"
                              src={slot.imageUrl}
                              alt={slot.label}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: highlightedSku && !isHighlighted ? 0.4 : 1,
                                transition: 'opacity 200ms ease',
                              }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.6rem', color: '#A0A0A8', textAlign: 'center', px: 0.5, lineHeight: 1.3 }}>
                              {slot.label}
                            </Typography>
                          )}

                          {/* Checkmark — shown when item is included in the current selection */}
                          {slot.included && (
                            <CheckCircleIcon
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                fontSize: '1rem',
                                color: '#F47F6B',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </Box>
                      </Tooltip>
                    )
                  })}
                </Box>
              )
            })()}

            {/* ── Lightbox ──────────────────────────────────────────────────── */}
            <Dialog
              open={!!lightboxUrl}
              onClose={() => setLightboxUrl(null)}
              maxWidth="md"
              PaperProps={{ sx: { backgroundColor: 'transparent', boxShadow: 'none' } }}
            >
              <Box
                component="img"
                src={lightboxUrl ?? ''}
                alt="Product"
                onClick={() => setLightboxUrl(null)}
                sx={{
                  maxWidth: '90vw',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  cursor: 'zoom-out',
                  display: 'block',
                }}
              />
            </Dialog>
          </Grid2>

          {/* ── Right column: configurator panel ─────────────────────────── */}
          <Grid2 size={{ xs: 12, md: 6 }}>

            <Typography
              variant="h4"
              component="h1"
              sx={{
                color: C.text,
                fontFamily: '"DM Sans", Inter, sans-serif',
                fontWeight: 700,
                fontSize: { xs: '1.75rem', md: '2rem' },
                mb: 0.5,
              }}
            >
              {bundleDisplayName(bundle.templateCode)}
            </Typography>

            {/* ── Party context ───────────────────────────────────────────── */}
            <Typography sx={{ color: C.meta, fontSize: '0.875rem', mt: 0.5, mb: 0 }}>
              Built for {quantity} guest{quantity !== 1 ? 's' : ''} · {quantity} complete bag{quantity !== 1 ? 's' : ''}
            </Typography>

            {/* ── Included section ────────────────────────────────────────── */}
            <Typography
              component="h2"
              sx={{ fontWeight: 700, fontSize: '1.15rem', color: C.text, mb: 0.5, mt: 3 }}
            >
              Included
            </Typography>
            <Typography sx={{ color: C.meta, fontSize: '0.875rem', mb: 1.5 }}>
              Four kid-picked favorites — tap any to see where it fits.
            </Typography>

            <Stack
              spacing={1.5}
              sx={{ mb: 3 }}
              role="group"
              aria-label="Included items"
            >
              {displayedItems.map((item) => (
                <IncludedItemCard
                  key={item.sku}
                  sku={item.sku}
                  name={item.productName}
                  description={item.description}
                  highlighted={highlightedSku === item.sku}
                  onClick={() => handleItemClick(item.sku)}
                />
              ))}
            </Stack>

            {/* ── Upgrade section ─────────────────────────────────────────── */}
            <Typography
              component="h2"
              sx={{ fontWeight: 700, fontSize: '1.15rem', color: C.text, mb: 0.5 }}
            >
              Upgrade
            </Typography>
            <Typography sx={{ color: C.meta, fontSize: '0.875rem', mb: 1.5 }}>
              Choose the version that fits your party.
            </Typography>

            <Stack
              spacing={1.5}
              sx={{ mb: 3 }}
              role="radiogroup"
              aria-label="Upgrade options"
              data-testid="upgrade-group"
            >
              {upgradeOptions.map((opt) => (
                <OptionCard
                  key={opt.id}
                  id={opt.id}
                  label={opt.label}
                  description={opt.description}
                  meta={opt.meta}
                  selected={upgradeOptionId === opt.id}
                  onClick={() => setUpgradeOptionId(opt.id)}
                />
              ))}
            </Stack>

            {/* ── Gift Bag section ─────────────────────────────────────────── */}
            <Typography
              component="h2"
              sx={{ fontWeight: 700, fontSize: '1.15rem', color: C.text, mb: 1.5 }}
            >
              Gift Bag
            </Typography>

            <Stack
              spacing={1.5}
              sx={{ mb: 3 }}
              role="radiogroup"
              aria-label="Gift bag options"
              data-testid="giftbag-group"
            >
              {giftBagOptions.map((opt) => (
                <OptionCard
                  key={opt.id}
                  id={opt.id}
                  label={opt.label}
                  description={opt.description}
                  meta={opt.meta}
                  selected={giftBagOptionId === opt.id}
                  onClick={() => setGiftBagOptionId(opt.id)}
                />
              ))}
            </Stack>

          </Grid2>
        </Grid2>

        {/* ── Sticky bottom CTA bar ────────────────────────────────────────
              Lives inside the same Container as the page content so its
              left/right edges are always pixel-perfect with the content above.
              Negative mx bleeds the white bg to the Container's outer edges;
              matching px re-adds the gutter so the button aligns with content. */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: { xs: 6, md: 8 },
            zIndex: 100,
            mx: { xs: -2, sm: -3 },
            px: { xs: 2, sm: 3 },
            py: 1.5,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E5E5EA',
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 2, sm: 3 },
          }}
        >
          {/* ── Party size selector (left) ───────────────────────────────── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, flexShrink: 0 }}>
            <Typography sx={{ color: C.meta, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Party Size
            </Typography>
            <Select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              size="small"
              sx={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: C.text,
                '.MuiOutlinedInput-notchedOutline': { borderColor: '#E5E5EA' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.accent },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.accent },
                borderRadius: '10px',
                minWidth: 88,
              }}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={n} sx={{ fontSize: '0.95rem' }}>{n} bag{n !== 1 ? 's' : ''}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* ── Order breakdown (center) ─────────────────────────────────── */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.15 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ color: C.meta, fontSize: '0.8rem' }}>
                {quantity} bag{quantity !== 1 ? 's' : ''} × ${displayPrice.toFixed(2)}
              </Typography>
              <Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 600 }}>
                ${(displayPrice * quantity).toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ color: C.meta, fontSize: '0.8rem' }}>Shipping</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Typography sx={{ color: C.meta, fontSize: '0.8rem', textDecoration: 'line-through' }}>$8.00</Typography>
                <Typography sx={{ color: 'success.main', fontSize: '0.8rem', fontWeight: 600 }}>FREE</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.25 }}>
              <Typography sx={{ color: '#143C78', fontSize: '0.85rem', fontWeight: 700 }}>Party Total</Typography>
              <Typography sx={{ color: '#143C78', fontSize: '1rem', fontWeight: 700 }}>
                ${totalPrice.toFixed(2)}
              </Typography>
            </Box>
          </Box>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          {continued ? (
            <Typography
              sx={{ color: C.meta, fontSize: '0.85rem', flexShrink: 0 }}
              data-testid="continue-confirmation"
            >
              Your selection is saved!
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
              <Button
                variant="contained"
                size="large"
                disabled={addingToCart}
                startIcon={addingToCart ? <CircularProgress size={16} color="inherit" /> : null}
                onClick={async () => {
                  if (!bundle) return
                  setAddingToCart(true)
                  addItem(
                    bundle,
                    upgradeOptionId === 'upgraded' ? 'PREMIUM' : 'STANDARD',
                    null,
                    quantity,
                  )
                  await refreshCart()
                  setContinued(true)
                  setAddingToCart(false)
                  navigate('/cart')
                }}
                data-testid="continue-btn"
                sx={{
                  backgroundColor: C.accent,
                  '&:hover': { backgroundColor: '#e06b57' },
                  fontSize: { xs: '0.85rem', sm: '1rem' },
                  py: 1,
                  minHeight: 52,
                  px: { xs: 2, sm: 3 },
                  whiteSpace: 'nowrap',
                }}
              >
                {addingToCart ? 'Adding…' : 'Continue'}
              </Button>
            </Box>
          )}
        </Box>

      </Container>

    </Box>
  )
}
