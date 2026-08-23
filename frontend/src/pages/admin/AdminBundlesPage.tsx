import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { adminApi } from '../../api/admin'
import type { AdminBundleListItem, AdminBundleDetail } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { AdminNav } from './AdminNav'

export function AdminBundlesPage() {
  const { authHeader } = useAdminAuth()
  const [bundles, setBundles] = useState<AdminBundleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminBundleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    if (!authHeader) return
    adminApi.getBundles(authHeader)
      .then(setBundles)
      .catch(() => setError('Failed to load bundles'))
      .finally(() => setLoading(false))
  }, [authHeader])

  function handleRowClick(publicId: string) {
    if (!authHeader) return
    if (selectedPublicId === publicId) {
      setSelectedPublicId(null)
      setDetail(null)
      return
    }
    setSelectedPublicId(publicId)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    adminApi.getBundleDetail(authHeader, publicId)
      .then(setDetail)
      .catch(() => setDetailError('Failed to load bundle detail'))
      .finally(() => setDetailLoading(false))
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F7F7F5' }}>
      <AdminNav />
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Bundles</Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && !error && (
          <TableContainer component={Paper} sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Public ID</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Age</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Interest</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Party Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Retail Price</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bundles.map(bundle => (
                  <TableRow
                    key={bundle.publicId}
                    hover
                    onClick={() => handleRowClick(bundle.publicId)}
                    selected={selectedPublicId === bundle.publicId}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{bundle.publicId}</TableCell>
                    <TableCell>{bundle.requestedAge}</TableCell>
                    <TableCell>{bundle.interest}</TableCell>
                    <TableCell>{bundle.partyType}</TableCell>
                    <TableCell>{bundle.templateCode}</TableCell>
                    <TableCell>{bundle.baseRetailPrice != null ? `$${bundle.baseRetailPrice.toFixed(2)}` : '—'}</TableCell>
                    <TableCell>{bundle.status}</TableCell>
                    <TableCell>{new Date(bundle.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {selectedPublicId && (
          <Paper sx={{ p: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Bundle Detail: <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: '0.9em' }}>{selectedPublicId}</span>
            </Typography>

            {detailLoading && <CircularProgress size={24} />}

            {detailError && <Alert severity="error">{detailError}</Alert>}

            {detail && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F7F7F5' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Slot</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Form Factor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.items.map(item => (
                      <TableRow key={item.sku}>
                        <TableCell>{item.slotCode}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.sku}</TableCell>
                        <TableCell>{item.formFactor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  )
}
