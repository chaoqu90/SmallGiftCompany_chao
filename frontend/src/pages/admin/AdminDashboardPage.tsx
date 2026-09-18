/**
 * AdminDashboardPage — redesigned with 4 tabs (FEAT-006).
 *
 * Tab 1: Overview — existing Finder Completions, Bundle Views, Product Coverage
 * Tab 2: Offline Fair — import form + analytics section
 * Tab 3: Online — date range picker + metrics + top-5 tables
 * Tab 4: Inventory — low stock + fast-moving + refresh button
 *
 * Requirements: FEAT-006 R-AF-1 through R-AI-3
 * Design: specs/analytics/design.md §D.1
 */
import { useEffect, useState, useMemo } from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { ArrowUpward, ArrowDownward } from '@mui/icons-material'
import { adminApi } from '../../api/admin'
import type { AdminDashboard, ProductCoverage } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'
import { OfflineFairImportForm } from './OfflineFairImportForm'
import { OfflineFairAnalyticsSection } from './OfflineFairAnalyticsSection'
import { OverviewAnalyticsSection } from './OverviewAnalyticsSection'
import { InventoryInsightsSection } from './InventoryInsightsSection'

// ─── Tab Panel ────────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  )
}

// ─── Overview Tab (existing content) ──────────────────────────────────────────

const AUDIENCE_LABELS: Record<string, string> = { FEMININE: 'Girls', MASCULINE: 'Boys', NO_PREFERENCE: 'No pref' }
const PARTY_LABELS:   Record<string, string> = { CELEBRATION: 'Party', HALLOWEEN: 'Halloween' }
const INTEREST_LABELS: Record<string, string> = {
  POP_MUSIC: 'Pop Music', TOYS_PLAY: 'Toys', CUTE_MAGICAL: 'Cute/Magic',
  SPORTS: 'Sports', READING_PUZZLE: 'Reading',
}
const BUDGET_LABELS: Record<string, string> = { LOW: 'Low', MID: 'Mid', HIGH: 'High' }

function coverageColor(pct: number): string {
  if (pct >= 0.5)  return '#2E7D32'
  if (pct >= 0.2)  return '#E65100'
  return '#C62828'
}

function chip(active: boolean, label: string, activeColor: string, activeBg: string) {
  return (
    <Chip key={label} label={label} size="small" sx={{
      fontSize: '0.7rem', height: 20,
      bgcolor: active ? activeBg : '#F5F5F5',
      color:   active ? activeColor : '#BDBDBD',
      border: 'none',
    }} />
  )
}

function CoverageRow({ row, odd }: { row: ProductCoverage; odd: boolean }) {
  const pct = row.appearanceCount / row.totalCombinations
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '1fr 90px 180px 150px 130px 220px 130px',
      gap: 2,
      px: 2,
      py: 1.25,
      minWidth: 1100,
      alignItems: 'center',
      bgcolor: odd ? '#FAFAF9' : '#FFFFFF',
      borderBottom: '1px solid #F0F0EE',
      '&:last-child': { borderBottom: 'none' },
    }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1D1D1F' }}>
        {row.name}
      </Typography>

      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: coverageColor(pct) }}>
          {Math.round(pct * 100)}%
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: '#6E6E73' }}>
          {row.appearanceCount}/{row.totalCombinations}
        </Typography>
      </Box>

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {['3-5', '6-8', '9-12'].map(a => chip(row.agesCovered.includes(a), a, '#2E7D32', '#E8F5E9'))}
      </Stack>

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {['FEMININE', 'MASCULINE', 'NO_PREFERENCE'].map(a =>
          chip(row.audiencesCovered.includes(a), AUDIENCE_LABELS[a], '#1565C0', '#E3F2FD'))}
      </Stack>

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {['CELEBRATION', 'HALLOWEEN'].map(p =>
          chip(row.partyTypesCovered.includes(p), PARTY_LABELS[p], '#E65100', '#FFF3E0'))}
      </Stack>

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {['POP_MUSIC', 'TOYS_PLAY', 'CUTE_MAGICAL', 'SPORTS', 'READING_PUZZLE'].map(i =>
          chip(row.interestsCovered.includes(i), INTEREST_LABELS[i], '#6A1B9A', '#F3E5F5'))}
      </Stack>

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {['LOW', 'MID', 'HIGH'].map(b =>
          chip(row.budgetsCovered.includes(b), BUDGET_LABELS[b], '#B8860B', '#FFFDE7'))}
      </Stack>
    </Box>
  )
}

interface StatCardProps { label: string; value: number }

function StatCard({ label, value }: StatCardProps) {
  return (
    <Paper sx={{ p: { xs: 2, md: 4 }, minWidth: 140, flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: '#1D1D1F' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography sx={{ fontSize: '0.875rem', color: '#6E6E73', textAlign: 'center' }}>
        {label}
      </Typography>
    </Paper>
  )
}

// ─── Filter chip group ────────────────────────────────────────────────────────

function FilterGroup({ label, options, selected, onToggle, activeColor, activeBg }: {
  label: string
  options: { value: string; display: string }[]
  selected: Set<string>
  onToggle: (v: string) => void
  activeColor: string
  activeBg: string
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', minWidth: 60 }}>{label}</Typography>
      {options.map(o => {
        const active = selected.has(o.value)
        return (
          <Chip
            key={o.value}
            label={o.display}
            size="small"
            onClick={() => onToggle(o.value)}
            sx={{
              fontSize: '0.72rem', height: 22, cursor: 'pointer',
              bgcolor: active ? activeBg : '#F0F0EE',
              color:   active ? activeColor : '#6E6E73',
              border: 'none',
              fontWeight: active ? 700 : 400,
              '&:hover': { bgcolor: active ? activeBg : '#E5E5E5' },
            }}
          />
        )
      })}
    </Box>
  )
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function OverviewTab() {
  const { authHeader } = useAdminAuth()
  const [dashboard, setDashboard]   = useState<AdminDashboard | null>(null)
  const [coverage,  setCoverage]    = useState<ProductCoverage[] | null>(null)
  const [loading,   setLoading]     = useState(true)
  const [error,     setError]       = useState<string | null>(null)

  // Sort: 'asc' = lowest first (default), 'desc' = highest first
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Filters — empty Set means "show all"
  const [ageFilter,      setAgeFilter]      = useState<Set<string>>(new Set())
  const [audienceFilter, setAudienceFilter] = useState<Set<string>>(new Set())
  const [partyFilter,    setPartyFilter]    = useState<Set<string>>(new Set())
  const [interestFilter, setInterestFilter] = useState<Set<string>>(new Set())
  const [budgetFilter,   setBudgetFilter]   = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authHeader) return
    Promise.all([
      adminApi.getDashboard(authHeader),
      adminApi.getProductCoverage(authHeader),
    ])
      .then(([d, c]) => { setDashboard(d); setCoverage(c) })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [authHeader])

  const filteredSorted = useMemo(() => {
    if (!coverage) return []
    return coverage
      .filter(row => {
        if (ageFilter.size      > 0 && !row.agesCovered.some(v      => ageFilter.has(v)))      return false
        if (audienceFilter.size > 0 && !row.audiencesCovered.some(v => audienceFilter.has(v))) return false
        if (partyFilter.size    > 0 && !row.partyTypesCovered.some(v => partyFilter.has(v)))   return false
        if (interestFilter.size > 0 && !row.interestsCovered.some(v  => interestFilter.has(v))) return false
        if (budgetFilter.size   > 0 && !row.budgetsCovered.some(v    => budgetFilter.has(v)))  return false
        return true
      })
      .sort((a, b) =>
        sortDir === 'asc'
          ? a.appearanceCount - b.appearanceCount
          : b.appearanceCount - a.appearanceCount,
      )
  }, [coverage, sortDir, ageFilter, audienceFilter, partyFilter, interestFilter, budgetFilter])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
  if (error)   return <Alert severity="error">{error}</Alert>

  return (
    <>
      {dashboard && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
          <StatCard label="Finder Completions" value={dashboard.finderCompletions} />
          <StatCard label="Bundle Views"        value={dashboard.bundleViews} />
        </Box>
      )}

      {coverage && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            Product Simulation Coverage
          </Typography>
          <Typography sx={{ color: '#6E6E73', fontSize: '0.875rem', mb: 2 }}>
            Simulated appearance rate across {coverage[0]?.totalCombinations ?? 270} filter combinations
            (3 ages × 5 interests × 3 audiences × 2 party types × budget tiers).
          </Typography>

          {/* ── Filters ── */}
          <Paper sx={{ p: 2, mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FilterGroup
              label="Age"
              options={[{ value: '3-5', display: '3–5' }, { value: '6-8', display: '6–8' }, { value: '9-12', display: '9–12' }]}
              selected={ageFilter}
              onToggle={v => setAgeFilter(s => toggle(s, v))}
              activeColor="#2E7D32" activeBg="#E8F5E9"
            />
            <FilterGroup
              label="Audience"
              options={[{ value: 'FEMININE', display: 'Girls' }, { value: 'MASCULINE', display: 'Boys' }, { value: 'NO_PREFERENCE', display: 'No pref' }]}
              selected={audienceFilter}
              onToggle={v => setAudienceFilter(s => toggle(s, v))}
              activeColor="#1565C0" activeBg="#E3F2FD"
            />
            <FilterGroup
              label="Party"
              options={[{ value: 'CELEBRATION', display: 'Party' }, { value: 'HALLOWEEN', display: 'Halloween' }]}
              selected={partyFilter}
              onToggle={v => setPartyFilter(s => toggle(s, v))}
              activeColor="#E65100" activeBg="#FFF3E0"
            />
            <FilterGroup
              label="Interest"
              options={[
                { value: 'POP_MUSIC', display: 'Pop Music' },
                { value: 'TOYS_PLAY', display: 'Toys' },
                { value: 'CUTE_MAGICAL', display: 'Cute/Magic' },
                { value: 'SPORTS', display: 'Sports' },
                { value: 'READING_PUZZLE', display: 'Reading' },
              ]}
              selected={interestFilter}
              onToggle={v => setInterestFilter(s => toggle(s, v))}
              activeColor="#6A1B9A" activeBg="#F3E5F5"
            />
            <FilterGroup
              label="Budget"
              options={[{ value: 'LOW', display: 'Low' }, { value: 'MID', display: 'Mid' }, { value: 'HIGH', display: 'High' }]}
              selected={budgetFilter}
              onToggle={v => setBudgetFilter(s => toggle(s, v))}
              activeColor="#B8860B" activeBg="#FFFDE7"
            />
          </Paper>

          {/* ── Table ── */}
          <Paper sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ minWidth: 1100 }}>
                {/* Header */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 180px 150px 130px 220px 130px', gap: 2, px: 2, py: 1.5, bgcolor: '#F0F0EE', borderBottom: '1px solid #E5E5EA', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</Typography>
                  {/* Sortable "Appears" header */}
                  <Box
                    onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', '&:hover': { color: '#1D1D1F' } }}
                  >
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appears</Typography>
                    {sortDir === 'asc'
                      ? <ArrowUpward sx={{ fontSize: 13, color: '#6E6E73' }} />
                      : <ArrowDownward sx={{ fontSize: 13, color: '#6E6E73' }} />}
                  </Box>
                  {['Age Ranges', 'Audiences', 'Party Types', 'Interests', 'Budgets'].map(h => (
                    <Typography key={h} sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</Typography>
                  ))}
                </Box>

                {filteredSorted.length === 0 ? (
                  <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: '#6E6E73' }}>No products match the selected filters.</Typography>
                  </Box>
                ) : (
                  filteredSorted.map((row, i) => (
                    <CoverageRow key={row.productId} row={row} odd={i % 2 === 1} />
                  ))
                )}
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
    </>
  )
}

// ─── Offline Fair Tab ─────────────────────────────────────────────────────────

function OfflineFairTab() {
  // Increment this to trigger OfflineFairAnalyticsSection to re-fetch the fair list
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <OfflineFairImportForm onImportSuccess={() => setRefreshTrigger(t => t + 1)} />
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Fair Analytics
        </Typography>
        <OfflineFairAnalyticsSection refreshTrigger={refreshTrigger} />
      </Box>
    </Box>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Dashboard</Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Dashboard tabs"
            variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="Overview"         />
            <Tab label="Inventory"        />
            <Tab label="Bundle Analysis"  />
            <Tab label="Offline Fair"     />
          </Tabs>
        </Box>

        <TabPanel value={tab} index={0}>
          <OverviewAnalyticsSection />
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <InventoryInsightsSection />
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <OverviewTab />
        </TabPanel>

        <TabPanel value={tab} index={3}>
          <OfflineFairTab />
        </TabPanel>
      </Box>
    </Box>
  )
}
