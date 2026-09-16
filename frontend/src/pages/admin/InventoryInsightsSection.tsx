/**
 * InventoryInsightsSection
 *
 * Displays inventory health data:
 *   - Low stock: bar chart of products at/below threshold, with urgency chips in table below
 *   - Fast-moving: bar chart of top 10 products by units sold in last 30 days
 *   - Refresh button for on-demand re-fetch
 *
 * Requirements: FEAT-006 R-AI-1, R-AI-2, R-AI-3
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { RefreshOutlined } from '@mui/icons-material'
import {
  adminApi,
  type InventoryInsights,
  type InventoryUrgency,
} from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

// ─── Urgency badge ────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<InventoryUrgency, { label: string; color: 'error' | 'warning' | 'default'; barColor: string }> = {
  CRITICAL: { label: 'Critical', color: 'error',   barColor: '#C62828' },
  VERY_LOW: { label: 'Very Low', color: 'warning',  barColor: '#EF6C00' },
  LOW:      { label: 'Low',      color: 'default',  barColor: '#F9A825' },
}

function UrgencyChip({ urgency }: { urgency: InventoryUrgency }) {
  const cfg = URGENCY_CONFIG[urgency]
  return <Chip label={cfg.label} color={cfg.color} size="small" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InventoryInsightsSection() {
  const { authHeader } = useAdminAuth()

  const [data, setData]       = useState<InventoryInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!authHeader) return
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.getInventoryInsights(authHeader))
    } catch {
      setError('Failed to load inventory insights.')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={fetchData} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}
      {error && !loading && <Alert severity="error">{error}</Alert>}

      {data && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* ── Low Stock ── */}
          <Box>
            <Typography variant="h6" fontWeight={700} mb={0.5}>Low Stock Products</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', mb: 2 }}>
              Active products with inventory at or below {data.lowStockThreshold} units
            </Typography>

            {data.lowStock.length === 0 ? (
              <Typography sx={{ color: '#2E7D32' }}>All products are well-stocked.</Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Bar chart */}
                <Paper sx={{ flex: 1, minWidth: 280, p: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <BarChart
                    layout="horizontal"
                    height={Math.max(180, data.lowStock.length * 36 + 50)}
                    yAxis={[{
                      scaleType: 'band',
                      data: data.lowStock.map(p => p.name),
                      tickLabelStyle: { fontSize: 11 },
                    }]}
                    series={[{
                      data: data.lowStock.map(p => p.inventoryQuantity),
                      label: 'Qty Remaining',
                      color: '#F47F6B',
                    }]}
                    margin={{ left: 130, right: 20, top: 10, bottom: 30 }}
                  />
                </Paper>

                {/* Detail table */}
                <Paper sx={{ flex: 1, minWidth: 280, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F0F0EE' }}>
                        {['Product', 'SKU', 'Qty', 'Urgency'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#6E6E73', textTransform: 'uppercase' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.lowStock.map((product, i) => {
                        const isCritical = product.urgency === 'CRITICAL'
                        return (
                          <TableRow
                            key={product.productId}
                            sx={{ bgcolor: isCritical ? '#FFEBEE' : i % 2 === 1 ? '#FAFAF9' : '#FFFFFF' }}
                          >
                            <TableCell sx={{ fontWeight: isCritical ? 700 : 400, fontSize: '0.875rem' }}>{product.name}</TableCell>
                            <TableCell sx={{ fontSize: '0.875rem', color: '#6E6E73' }}>{product.sku}</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', color: isCritical ? '#C62828' : '#1D1D1F' }}>
                              {product.inventoryQuantity}
                            </TableCell>
                            <TableCell><UrgencyChip urgency={product.urgency} /></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            )}
          </Box>

          {/* ── Fast Moving ── */}
          <Box>
            <Typography variant="h6" fontWeight={700} mb={0.5}>Fast-Moving Products</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', mb: 2 }}>
              Top 10 products by units sold in the last {data.fastMovingWindowDays} days (online + offline combined)
            </Typography>

            {data.fastMoving.length === 0 ? (
              <Typography sx={{ color: '#6E6E73' }}>No sales recorded in the last 30 days.</Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Bar chart */}
                <Paper sx={{ flex: 1, minWidth: 280, p: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <BarChart
                    layout="horizontal"
                    height={Math.max(180, data.fastMoving.length * 36 + 50)}
                    yAxis={[{
                      scaleType: 'band',
                      data: data.fastMoving.map(p => p.name),
                      tickLabelStyle: { fontSize: 11 },
                    }]}
                    series={[{
                      data: data.fastMoving.map(p => p.unitsSoldLast30Days),
                      label: 'Units Sold (30d)',
                      color: '#1976D2',
                    }]}
                    margin={{ left: 130, right: 20, top: 10, bottom: 30 }}
                  />
                </Paper>

                {/* Detail table */}
                <Paper sx={{ flex: 1, minWidth: 280, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F0F0EE' }}>
                        {['#', 'Product', 'Units (30d)', 'Stock'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#6E6E73', textTransform: 'uppercase' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.fastMoving.map((product, i) => (
                        <TableRow key={product.productId || product.sku} sx={{ bgcolor: i % 2 === 1 ? '#FAFAF9' : '#FFFFFF' }}>
                          <TableCell sx={{ color: '#6E6E73', fontSize: '0.875rem' }}>{i + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{product.name}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{product.unitsSoldLast30Days.toLocaleString()}</TableCell>
                          <TableCell sx={{ fontSize: '0.875rem' }}>{product.inventoryQuantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            )}
          </Box>

        </Box>
      )}
    </Box>
  )
}
