/**
 * AdminBundlePreviewPage — admin-only preview of a generated bundle.
 *
 * Reuses layout sub-components (ConfiguratorVisual, IncludedItemCard, OptionCard)
 * from BundleCustomizationPage, but is an entirely separate component. The
 * customer page MUST NOT be modified.
 *
 * Features:
 *  - Loads bundle from public GET /api/generated-bundles/:bundlePublicId
 *  - Sticky top bar with "Back to Future Parties" link
 *  - Swap icon on each item card — opens swap modal
 *  - Swap modal: loads alternatives, lets admin select and confirm replacement
 *  - Sticky bottom bar with "Send Link" / "Re-send" button (when futurePartyId provided)
 *
 * Route: /admin/bundle-preview/:bundlePublicId?futurePartyId=:futurePartyId
 *
 * Requirements: R-FP-A (AC-FP-A.1 – AC-FP-A.6), R-FP-C (AC-FP-C.1 – AC-FP-C.9)
 * Design: specs/future-party/design.md §5.5
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SearchIcon from '@mui/icons-material/Search'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { adminApi, type AlternativeProductDto } from '../../api/admin'
import { ConfiguratorVisual } from '../../components/ConfiguratorVisual'
import { IncludedItemCard } from '../../components/IncludedItemCard'
import { OptionCard } from '../../components/OptionCard'
import type { GeneratedBundleResponse, GeneratedBundleItemDto } from '../../types/catalog'

// ── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const C = {
  bg:     '#F7F7F5',
  text:   '#1D1D1F',
  meta:   '#6E6E73',
  accent: '#F47F6B',
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Date helpers ─────────────────────────────────────────────────────────────

const sentAtFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
})

function formatSentAt(iso: string): string {
  return sentAtFormatter.format(new Date(iso))
}

// ── Template display name ────────────────────────────────────────────────────

function bundleDisplayName(templateCode: string): string {
  if (templateCode === 'PRESCHOOL_4_ITEM')     return "Little One's Bundle"
  if (templateCode === 'READING_PUZZLE_4_ITEM') return 'Reading & Puzzle Bundle'
  return 'Your Custom Bundle'
}

// ── AdminBundlePreviewPage ───────────────────────────────────────────────────

export function AdminBundlePreviewPage() {
  const { bundlePublicId } = useParams<{ bundlePublicId: string }>()
  const [searchParams]     = useSearchParams()
  const futurePartyId      = searchParams.get('futurePartyId')
  const navigate           = useNavigate()
  const { authHeader }     = useAdminAuth()

  // Bundle state
  const [bundle,    setBundle]    = useState<GeneratedBundleResponse | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Visual highlight state
  const [highlightedSku, setHighlightedSku] = useState<string | null>(null)
  const [upgradeOptionId, setUpgradeOptionId] = useState<string>('standard')
  const [giftBagOptionId, setGiftBagOptionId] = useState<string>('classic')

  // Send link state (AC-FP-A.3, AC-FP-A.4)
  const [sending,       setSending]       = useState(false)
  const [sendError,     setSendError]     = useState<string | null>(null)
  const [sentAt,        setSentAt]        = useState<string | null>(null)
  const [savedSnackbar, setSavedSnackbar] = useState(false)

  // Swap modal state (AC-FP-C.1 – AC-FP-C.9)
  const [swapSlotCode,    setSwapSlotCode]    = useState<string | null>(null)
  const [swapSlotName,    setSwapSlotName]    = useState<string>('')   // slot code label
  const [swapCurrentName, setSwapCurrentName] = useState<string>('')   // current product name
  const [alternatives,    setAlternatives]    = useState<AlternativeProductDto[]>([])
  const [altLoading,      setAltLoading]      = useState(false)
  const [altError,        setAltError]        = useState<string | null>(null)
  const [altSearch,       setAltSearch]       = useState('')
  const [expandedAltId,   setExpandedAltId]   = useState<number | null>(null)
  const [selectedAltId,   setSelectedAltId]   = useState<number | null>(null)
  const [swapping,        setSwapping]        = useState(false)
  const [swapError,       setSwapError]       = useState<string | null>(null)

  const filteredAlternatives = useMemo(
    () => altSearch.trim()
      ? alternatives.filter(a => a.name.toLowerCase().includes(altSearch.toLowerCase()) || a.sku.toLowerCase().includes(altSearch.toLowerCase()))
      : alternatives,
    [alternatives, altSearch],
  )

  // ── Load bundle on mount (AC-FP-A.2) ─────────────────────────────────────

  useEffect(() => {
    if (!bundlePublicId) {
      navigate('/admin/future-parties')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${BASE_URL}/api/generated-bundles/${bundlePublicId}`)
      .then(res => {
        if (!res.ok) throw new Error(`Bundle not found (${res.status})`)
        return res.json() as Promise<GeneratedBundleResponse>
      })
      .then(data => {
        if (!cancelled) {
          setBundle(data)
          setGiftBagOptionId(data.giftBag?.code ?? 'classic')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Bundle not found.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [bundlePublicId, navigate])

  // ── Load alternatives when swap modal opens (design §5.5) ─────────────────

  useEffect(() => {
    if (!swapSlotCode || !bundlePublicId || !authHeader) return

    let cancelled = false
    setAltLoading(true)
    setAltError(null)
    setAlternatives([])
    setSelectedAltId(null)

    adminApi.getAlternativesForSlot(authHeader, bundlePublicId, swapSlotCode)
      .then(data => { if (!cancelled) setAlternatives(data) })
      .catch(() => { if (!cancelled) setAltError('Failed to load alternatives.') })
      .finally(() => { if (!cancelled) setAltLoading(false) })

    return () => { cancelled = true }
  }, [swapSlotCode, bundlePublicId, authHeader])

  // ── Send Link (AC-FP-A.4) ─────────────────────────────────────────────────

  async function handleSendLink() {
    if (!authHeader || !futurePartyId) return
    setSending(true)
    setSendError(null)
    try {
      const { sentAt: newSentAt } = await adminApi.sendFuturePartyLink(authHeader, Number(futurePartyId))
      setSentAt(newSentAt)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  // ── Confirm swap (AC-FP-C.5, AC-FP-C.6, AC-FP-C.7) ─────────────────────

  async function handleSwapConfirm() {
    if (!selectedAltId || !swapSlotCode || !bundlePublicId || !authHeader) return
    setSwapping(true)
    setSwapError(null)
    try {
      const updated = await adminApi.patchBundleItem(authHeader, bundlePublicId, swapSlotCode, selectedAltId)
      setBundle(updated)
      setSwapSlotCode(null)
      setSelectedAltId(null)
      setSwapError(null)
      setAltSearch('')
      setExpandedAltId(null)
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Failed to replace product.')
    } finally {
      setSwapping(false)
    }
  }

  function handleSwapCancel() {
    setSwapSlotCode(null)
    setSelectedAltId(null)
    setSwapError(null)
    setAltSearch('')
    setExpandedAltId(null)
  }

  // ── Loading state (AC-FP-A.6) ─────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ backgroundColor: C.bg, minHeight: '100vh' }}>
        <AdminNav />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  // ── Error state (AC-FP-A.6) ──────────────────────────────────────────────

  if (error || !bundle) {
    return (
      <Box sx={{ backgroundColor: C.bg, minHeight: '100vh' }}>
        <AdminNav />
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error ?? 'Bundle not found.'}
          </Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/future-parties')}>
            Back to Future Parties
          </Button>
        </Container>
      </Box>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const displayedItems: GeneratedBundleItemDto[] = bundle.items
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)

  // Build upgrade options (mirrors BundleCustomizationPage)
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

  return (
    <Box sx={{ backgroundColor: C.bg, minHeight: '100vh' }}>
      <AdminNav />

      {/* ── Sticky top bar (AC-FP-A.5) ──────────────────────────────────── */}
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
          onClick={() => navigate('/admin/future-parties')}
          sx={{ color: C.meta, minWidth: 0, px: 1 }}
        >
          Back to Future Parties
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          Admin Preview — {bundle.generatedBundleId}
        </Typography>
      </Box>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 5, md: 8 } }}>
        <Grid2 container spacing={{ xs: 3, md: 6 }} alignItems="flex-start">

          {/* ── Left column: geometric visual ──────────────────────────────── */}
          <Grid2
            size={{ xs: 12, md: 6 }}
            sx={{ position: { md: 'sticky' }, top: { md: 72 } }}
          >
            <ConfiguratorVisual
              items={displayedItems.map(item => ({ sku: item.sku, formFactor: item.formFactor }))}
              highlightedSku={highlightedSku}
              onShapeClick={sku => setHighlightedSku(prev => prev === sku ? null : sku)}
            />
          </Grid2>

          {/* ── Right column: item cards + options ──────────────────────────── */}
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

            {/* ── Included section with swap icons (AC-FP-C.1) ──────────────── */}
            <Typography
              component="h2"
              sx={{ fontWeight: 700, fontSize: '1.15rem', color: C.text, mb: 0.5, mt: 3 }}
            >
              Included
            </Typography>
            <Typography sx={{ color: C.meta, fontSize: '0.875rem', mb: 1.5 }}>
              Click the swap icon to replace an item.
            </Typography>

            <Stack spacing={1.5} sx={{ mb: 3 }} role="group" aria-label="Included items">
              {displayedItems.map(item => (
                <Box
                  key={item.slotCode}
                  sx={{ position: 'relative' }}
                >
                  <IncludedItemCard
                    sku={item.sku}
                    name={item.productName}
                    description={item.description}
                    highlighted={highlightedSku === item.sku}
                    onClick={() => setHighlightedSku(prev => prev === item.sku ? null : item.sku)}
                  />
                  {/* Swap icon button (AC-FP-C.1) — always visible */}
                  <IconButton
                    size="small"
                    aria-label={`Replace ${item.productName}`}
                    onClick={() => {
                      setSwapSlotCode(item.slotCode)
                      setSwapSlotName(item.slotCode)
                      setSwapCurrentName(item.productName)
                    }}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      border: '1px solid #D2D2D7',
                      '&:hover': { backgroundColor: '#F0F4FA' },
                    }}
                  >
                    <SwapHorizIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>

            {/* ── Upgrade section ──────────────────────────────────────────── */}
            <Typography
              component="h2"
              sx={{ fontWeight: 700, fontSize: '1.15rem', color: C.text, mb: 0.5 }}
            >
              Upgrade
            </Typography>
            <Stack spacing={1.5} sx={{ mb: 3 }} role="radiogroup" aria-label="Upgrade options">
              {upgradeOptions.map(opt => (
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
            <Stack spacing={1.5} sx={{ mb: 3 }} role="radiogroup" aria-label="Gift bag options">
              {giftBagOptions.map(opt => (
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

        {/* ── Sticky bottom CTA bar ───────────────────────────────────────── */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: { xs: 6, md: 8 },
            zIndex: 100,
            mx: 0,
            px: { xs: 2, sm: 3 },
            py: 1.5,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E5E5EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {/* Total price — updates after each swap */}
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="caption" color="text.secondary">Bundle Total</Typography>
            <Typography variant="h6" fontWeight={700} lineHeight={1}>
              {bundle.bundleRetailPrice != null ? fmt.format(bundle.bundleRetailPrice) : '—'}
            </Typography>
          </Box>

          {sentAt && (
            <Typography variant="body2" color="text.secondary">
              Last sent {formatSentAt(sentAt)}
            </Typography>
          )}

          {/* Save Bundle — persists item swaps (already saved) and navigates back */}
          <Button
            variant="outlined"
            onClick={() => {
              setSavedSnackbar(true)
              setTimeout(() => navigate('/admin/future-parties'), 1200)
            }}
            disabled={sending}
          >
            Save Bundle
          </Button>

          {/* Save and Send — only available when linked to a future party */}
          {futurePartyId && (
            <Button
              variant="contained"
              color="primary"
              disabled={sending}
              onClick={handleSendLink}
              startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {sending ? 'Sending…' : sentAt ? 'Save and Re-send' : 'Save and Send'}
            </Button>
          )}
        </Box>

        {/* Send error */}
        {sendError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {sendError}
          </Alert>
        )}
      </Container>

      <Snackbar
        open={savedSnackbar}
        autoHideDuration={2000}
        onClose={() => setSavedSnackbar(false)}
        message="Bundle saved"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* ── Swap modal (AC-FP-C.2 – AC-FP-C.9) ─────────────────────────── */}
      <Dialog
        open={swapSlotCode !== null}
        onClose={handleSwapCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          Replace Item
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
            Slot: <strong>{swapSlotName}</strong> · Currently: {swapCurrentName}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {/* Search bar */}
          {!altLoading && !altError && alternatives.length > 0 && (
            <TextField
              size="small"
              fullWidth
              placeholder="Search by name or SKU…"
              value={altSearch}
              onChange={e => setAltSearch(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Loading alternatives */}
          {altLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Alternatives load error */}
          {!altLoading && altError && (
            <Alert severity="error">{altError}</Alert>
          )}

          {/* Empty state */}
          {!altLoading && !altError && alternatives.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No alternative products are available for this slot.
            </Typography>
          )}

          {/* No search results */}
          {!altLoading && !altError && alternatives.length > 0 && filteredAlternatives.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No products match "{altSearch}".
            </Typography>
          )}

          {/* Alternatives list */}
          {!altLoading && !altError && filteredAlternatives.length > 0 && (
            <List disablePadding>
              {filteredAlternatives.map(alt => {
                const isSelected = selectedAltId === alt.id
                const isExpanded = expandedAltId === alt.id
                return (
                  <Box
                    key={alt.id}
                    sx={{
                      mb: 0.75,
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.06)' : 'background.paper',
                    }}
                  >
                    {/* Collapsed row — always visible */}
                    <ListItemButton
                      selected={isSelected}
                      onClick={() => setSelectedAltId(alt.id)}
                      sx={{
                        py: 1,
                        '&.Mui-selected': { backgroundColor: 'transparent' },
                        '&.Mui-selected:hover': { backgroundColor: 'rgba(25,118,210,0.04)' },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{alt.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {alt.sku} · {alt.formFactor} · ${Number(alt.retailPrice).toFixed(2)}
                        </Typography>
                      </Box>
                      <Chip
                        label={`${alt.inventoryQuantity} in stock`}
                        size="small"
                        color={alt.inventoryQuantity < 5 ? 'warning' : 'default'}
                        sx={{ mr: 1, fontSize: 11 }}
                      />
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation()
                          setExpandedAltId(prev => prev === alt.id ? null : alt.id)
                        }}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </ListItemButton>

                    {/* Expanded detail */}
                    <Collapse in={isExpanded} unmountOnExit>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 2,
                          px: 2,
                          pb: 2,
                          pt: 0.5,
                          borderTop: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: '#FAFAFA',
                        }}
                      >
                        {/* Product image */}
                        {alt.imageUrl ? (
                          <Box
                            component="img"
                            src={alt.imageUrl}
                            alt={alt.name}
                            sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 80, height: 80, borderRadius: 1, flexShrink: 0,
                              backgroundColor: '#E5E5EA',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Typography variant="caption" color="text.disabled">No image</Typography>
                          </Box>
                        )}

                        {/* Details */}
                        <Stack spacing={0.5} justifyContent="center">
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Cost</Typography>
                              <Typography variant="body2" fontWeight={600}>${Number(alt.cost).toFixed(2)}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Retail</Typography>
                              <Typography variant="body2" fontWeight={600}>${Number(alt.retailPrice).toFixed(2)}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">Inventory</Typography>
                              <Typography variant="body2" fontWeight={600}>{alt.inventoryQuantity}</Typography>
                            </Box>
                          </Box>
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                )
              })}
            </List>
          )}

          {/* Swap error */}
          {swapError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {swapError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleSwapCancel} disabled={swapping}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSwapConfirm}
            disabled={selectedAltId === null || swapping}
          >
            {swapping
              ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Replacing…</>
              : 'Replace'
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
