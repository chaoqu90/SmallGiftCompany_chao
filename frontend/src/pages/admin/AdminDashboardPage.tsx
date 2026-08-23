import { useEffect, useState } from 'react'
import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { adminApi } from '../../api/admin'
import type { AdminDashboard, ProductCoverage } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'

export function AdminDashboardPage() {
  const { authHeader } = useAdminAuth()
  const [dashboard, setDashboard]   = useState<AdminDashboard | null>(null)
  const [coverage,  setCoverage]    = useState<ProductCoverage[] | null>(null)
  const [loading,   setLoading]     = useState(true)
  const [error,     setError]       = useState<string | null>(null)

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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Dashboard</Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {dashboard && (
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
            <StatCard label="Finder Completions" value={dashboard.finderCompletions} />
            <StatCard label="Bundle Views"        value={dashboard.bundleViews} />
          </Box>
        )}

        {coverage && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Product Simulation Coverage
            </Typography>
            <Typography sx={{ color: '#6E6E73', fontSize: '0.875rem', mb: 2 }}>
              Simulated appearance rate across {coverage[0]?.totalCombinations ?? 270} filter combinations
              (3 ages × 5 interests × 3 audiences × 2 party types × budget tiers). Sorted by lowest first.
            </Typography>
            <Paper sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Box sx={{ minWidth: 1100 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 180px 150px 130px 220px 130px', gap: 2, px: 2, py: 1.5, bgcolor: '#F0F0EE', borderBottom: '1px solid #E5E5EA' }}>
                    {['Product', 'Appears', 'Age Ranges', 'Audiences', 'Party Types', 'Interests', 'Budgets'].map(h => (
                      <Typography key={h} sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</Typography>
                    ))}
                  </Box>
                  {coverage.map((row, i) => (
                    <CoverageRow key={row.productId} row={row} odd={i % 2 === 1} />
                  ))}
                </Box>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// -- Helpers ------------------------------------------------------------------

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
    <Paper sx={{ p: 4, minWidth: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: '#1D1D1F' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography sx={{ fontSize: '0.875rem', color: '#6E6E73', textAlign: 'center' }}>
        {label}
      </Typography>
    </Paper>
  )
}
