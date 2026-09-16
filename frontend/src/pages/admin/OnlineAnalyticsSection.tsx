/**
 * OnlineAnalyticsSection
 *
 * Displays online shopping analytics for a selected date range:
 *   - Preset selector: Last 30 days (default), Last 90 days, Last 12 months, Custom
 *   - Three summary metric cards: Total Units Sold, Gross Income, Net Income
 *   - Two bar charts: top 5 by units sold, top 5 by estimated profit
 *
 * Requirements: FEAT-006 R-AO-1, R-AO-2, R-AO-3, R-AO-4
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { adminApi, type OnlineAnalytics } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return toIsoDate(d) }
function today(): string { return toIsoDate(new Date()) }

type Preset = '30d' | '90d' | '12m' | 'custom'

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Last 30 days',   value: '30d' },
  { label: 'Last 90 days',   value: '90d' },
  { label: 'Last 12 months', value: '12m' },
  { label: 'Custom',         value: 'custom' },
]

function presetDates(preset: Preset): { dateFrom: string; dateTo: string } | null {
  const t = today()
  if (preset === '30d') return { dateFrom: daysAgo(30),  dateTo: t }
  if (preset === '90d') return { dateFrom: daysAgo(90),  dateTo: t }
  if (preset === '12m') return { dateFrom: daysAgo(365), dateTo: t }
  return null
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 3, minWidth: 180, flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, color: '#1D1D1F' }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', mt: 0.5 }}>{label}</Typography>
    </Paper>
  )
}

// ─── Chart Card ───────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ flex: 1, minWidth: 300, p: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <Typography variant="subtitle1" fontWeight={700} mb={subtitle ? 0.25 : 1}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: '0.72rem', color: '#6E6E73', mb: 1 }}>{subtitle}</Typography>}
      {children}
    </Paper>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnlineAnalyticsSection() {
  const { authHeader } = useAdminAuth()

  const [preset, setPreset]         = useState<Preset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [rangeError, setRangeError] = useState<string | null>(null)

  const [analytics, setAnalytics]   = useState<OnlineAnalytics | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const effectiveDates = useCallback((): { dateFrom: string; dateTo: string } | null => {
    if (preset !== 'custom') return presetDates(preset)
    if (customFrom && customTo) return { dateFrom: customFrom, dateTo: customTo }
    return null
  }, [preset, customFrom, customTo])

  const fetchAnalytics = useCallback(async () => {
    if (!authHeader) return
    const dates = effectiveDates()
    if (!dates) return
    setError(null)
    setLoading(true)
    try {
      const result = await adminApi.getOnlineAnalytics(authHeader, dates.dateFrom, dates.dateTo)
      setAnalytics(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [authHeader, effectiveDates])

  useEffect(() => {
    if (preset !== 'custom') { setRangeError(null); fetchAnalytics() }
  }, [preset, fetchAnalytics])

  function handleCustomApply() {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) { setRangeError('Start date must be before end date.'); return }
    setRangeError(null)
    fetchAnalytics()
  }

  const noData = analytics && analytics.topByUnits.length === 0

  return (
    <Box>
      {/* Preset selector */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {PRESETS.map(p => (
            <Button key={p.value} size="small"
              variant={preset === p.value ? 'contained' : 'outlined'}
              onClick={() => setPreset(p.value)}>
              {p.label}
            </Button>
          ))}
        </Box>

        {preset === 'custom' && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              label="Start Date" type="date" size="small" value={customFrom}
              onChange={e => { setCustomFrom(e.target.value); setRangeError(null) }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date" type="date" size="small" value={customTo}
              onChange={e => { setCustomTo(e.target.value); setRangeError(null) }}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" size="small" onClick={handleCustomApply} sx={{ mt: 0.5 }}>Apply</Button>
            {rangeError && <Alert severity="error" sx={{ py: 0.5 }}>{rangeError}</Alert>}
          </Box>
        )}
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}
      {error && !loading && <Alert severity="error">{error}</Alert>}

      {analytics && !loading && (
        <>
          {/* Metric cards */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
            <MetricCard label="Total Units Sold" value={analytics.totalUnitsSold.toLocaleString()} />
            <MetricCard label="Gross Income"     value={formatCurrency(analytics.grossIncome)} />
            <MetricCard label="Net Income"       value={formatCurrency(analytics.netIncome)} />
          </Box>

          {noData ? (
            <Typography sx={{ color: '#6E6E73' }}>No orders in this period.</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <ChartCard title="Top Products by Units Sold">
                <BarChart
                  layout="horizontal"
                  height={240}
                  yAxis={[{
                    scaleType: 'band',
                    data: analytics.topByUnits.map(r => r.productName),
                    tickLabelStyle: { fontSize: 11 },
                  }]}
                  series={[{
                    data: analytics.topByUnits.map(r => r.unitsSold),
                    label: 'Units Sold',
                    color: '#F47F6B',
                  }]}
                  margin={{ left: 130, right: 20, top: 10, bottom: 30 }}
                />
              </ChartCard>

              <ChartCard
                title="Top Products by Estimated Profit"
                subtitle="Estimated by apportioning bundle revenue equally among product slots."
              >
                <BarChart
                  layout="horizontal"
                  height={240}
                  yAxis={[{
                    scaleType: 'band',
                    data: analytics.topByProfit.map(r => r.productName),
                    tickLabelStyle: { fontSize: 11 },
                  }]}
                  series={[{
                    data: analytics.topByProfit.map(r => r.estimatedProfit),
                    label: 'Est. Profit ($)',
                    color: '#4CAF50',
                    valueFormatter: (v) => formatCurrency(v ?? 0),
                  }]}
                  margin={{ left: 130, right: 20, top: 10, bottom: 30 }}
                />
              </ChartCard>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
