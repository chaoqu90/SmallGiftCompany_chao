/**
 * OfflineFairAnalyticsSection
 *
 * Displays analytics for a selected offline fair:
 *   - Dropdown populated with all fairs, ordered by fair_date DESC
 *   - Three summary metric cards: Total Products Sold, Gross Income, Net Income
 *   - Two bar charts: top 5 by quantity sold, top 5 by profit
 *
 * Requirements: FEAT-006 R-AD-1, R-AD-2, R-AD-3
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Typography,
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import {
  adminApi,
  type OfflineFairListItem,
  type OfflineFairAnalytics,
} from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 3, minWidth: 180, flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, color: '#1D1D1F' }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', mt: 0.5 }}>
        {label}
      </Typography>
    </Paper>
  )
}

// ─── Bar Chart Card ───────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ flex: 1, minWidth: 300, p: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <Typography variant="subtitle1" fontWeight={700} mb={1}>{title}</Typography>
      {children}
    </Paper>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OfflineFairAnalyticsSection({ refreshTrigger }: { refreshTrigger?: number }) {
  const { authHeader } = useAdminAuth()

  const [fairs, setFairs]           = useState<OfflineFairListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [analytics, setAnalytics]   = useState<OfflineFairAnalytics | null>(null)
  const [loading, setLoading]       = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const loadFairs = useCallback(async () => {
    if (!authHeader) return
    setLoading(true)
    setError(null)
    try {
      const list = await adminApi.listOfflineFairs(authHeader)
      setFairs(list)
      if (list.length > 0) {
        setSelectedId(list[0].id)
      } else {
        setSelectedId(null)
        setAnalytics(null)
      }
    } catch {
      setError('Failed to load fairs.')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { loadFairs() }, [loadFairs, refreshTrigger])

  useEffect(() => {
    if (!authHeader || selectedId == null) return
    setAnalyticsLoading(true)
    setAnalytics(null)
    adminApi.getOfflineFairAnalytics(authHeader, selectedId)
      .then(setAnalytics)
      .catch(() => setError('Failed to load fair analytics.'))
      .finally(() => setAnalyticsLoading(false))
  }, [authHeader, selectedId])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>
  if (fairs.length === 0) return <Typography sx={{ color: '#6E6E73', mt: 2 }}>No fairs recorded yet. Import a fair to get started.</Typography>

  return (
    <Box>
      {/* Fair selector */}
      <FormControl sx={{ minWidth: { xs: '100%', sm: 360 }, mb: 3 }}>
        <InputLabel id="fair-select-label">Select Fair</InputLabel>
        <Select
          labelId="fair-select-label"
          value={selectedId ?? ''}
          label="Select Fair"
          onChange={(e: SelectChangeEvent<number>) => setSelectedId(Number(e.target.value))}
        >
          {fairs.map(f => (
            <MenuItem key={f.id} value={f.id}>
              {f.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {analyticsLoading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {analytics && !analyticsLoading && (
        <>
          {/* Metric cards */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
            <MetricCard label="Total Products Sold" value={analytics.totalUnitsSold.toLocaleString()} />
            <MetricCard label="Gross Income"        value={formatCurrency(analytics.grossIncome)} />
            <MetricCard label="Net Income"          value={formatCurrency(analytics.netIncome)} />
          </Box>

          {/* Charts */}
          {analytics.topByQuantity.length === 0 ? (
            <Typography sx={{ color: '#6E6E73' }}>No sales recorded for this fair.</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <ChartCard title="Top Products by Quantity Sold">
                <BarChart
                  layout="horizontal"
                  height={240}
                  yAxis={[{
                    scaleType: 'band',
                    data: analytics.topByQuantity.map(r => r.productName),
                    tickLabelStyle: { fontSize: 11 },
                  }]}
                  series={[{
                    data: analytics.topByQuantity.map(r => r.quantitySold),
                    label: 'Qty Sold',
                    color: '#F47F6B',
                  }]}
                  margin={{ left: 130, right: 20, top: 10, bottom: 30 }}
                />
              </ChartCard>

              <ChartCard title="Top Products by Profit">
                <BarChart
                  layout="horizontal"
                  height={240}
                  yAxis={[{
                    scaleType: 'band',
                    data: analytics.topByProfit.map(r => r.productName),
                    tickLabelStyle: { fontSize: 11 },
                  }]}
                  series={[{
                    data: analytics.topByProfit.map(r => r.profit),
                    label: 'Profit ($)',
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
