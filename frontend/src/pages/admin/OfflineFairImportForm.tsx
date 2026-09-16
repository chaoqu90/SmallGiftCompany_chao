/**
 * OfflineFairImportForm
 *
 * Form for importing an offline fair from an xlsx file.
 * Fields: Fair Name (text, required), Fair Date (date, required), File (.xlsx only).
 *
 * On success: displays a summary and optional warnings in a collapsible section.
 * On server 422: displays row-level errors inline without navigating away.
 * On other server error: displays the error message inline.
 *
 * Uses native fetch (not adminRequest) for the multipart upload so the browser
 * sets Content-Type: multipart/form-data with the correct boundary.
 *
 * Requirements: FEAT-006 R-AF-1 through R-AF-5
 * Design: specs/analytics/design.md §D.2
 */
import { useState, useRef } from 'react'
import {
  Alert,
  Box,
  Button,
  Collapse,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { adminApi, type OfflineFairImportResult } from '../../api/admin'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

// ─── Import Success Summary ───────────────────────────────────────────────────

function ImportSuccessSummary({ result }: { result: OfflineFairImportResult }) {
  const [warningsOpen, setWarningsOpen] = useState(false)

  return (
    <Paper sx={{ p: 3, border: '1px solid #4CAF50', bgcolor: '#F1FBF4' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32', mb: 1 }}>
        Import Successful
      </Typography>
      <Typography sx={{ mb: 0.5 }}>
        <strong>Fair:</strong> {result.fairName} — {result.fairDate}
      </Typography>
      <Typography sx={{ mb: 0.5 }}>
        <strong>SKUs processed:</strong> {result.skusProcessed}
      </Typography>
      <Typography sx={{ mb: 0.5 }}>
        <strong>Sale rows created:</strong> {result.saleRowsCreated}
      </Typography>
      <Typography sx={{ mb: 0.5 }}>
        <strong>Inventory updated:</strong> {result.inventoryUpdated} product(s)
      </Typography>

      {result.warnings.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={() => setWarningsOpen(v => !v)}
            sx={{ mb: 1 }}
          >
            {warningsOpen ? 'Hide' : 'Show'} {result.warnings.length} warning(s)
          </Button>
          <Collapse in={warningsOpen}>
            <Alert severity="warning" sx={{ mt: 1 }}>
              <List dense disablePadding>
                {result.warnings.map((w, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                    <ListItemText primary={w} primaryTypographyProps={{ fontSize: '0.85rem' }} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          </Collapse>
        </Box>
      )}
    </Paper>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OfflineFairImportForm({ onImportSuccess }: { onImportSuccess?: () => void }) {
  const { authHeader } = useAdminAuth()

  const [fairName, setFairName]         = useState('')
  const [fairDate, setFairDate]         = useState('')
  const [file, setFile]                 = useState<File | null>(null)
  const [fileError, setFileError]       = useState<string | null>(null)
  const [fieldErrors, setFieldErrors]   = useState<{ name?: string; date?: string; file?: string }>({})
  const [submitting, setSubmitting]     = useState(false)
  const [serverError, setServerError]   = useState<string | null>(null)
  const [result, setResult]             = useState<OfflineFairImportResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    setFile(null)
    const selected = e.target.files?.[0] ?? null
    if (!selected) return

    if (!selected.name.endsWith('.xlsx')) {
      setFileError('Only .xlsx files are accepted.')
      // Reset the file input so the user can pick again
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setFile(selected)
  }

  function validate(): boolean {
    const errors: { name?: string; date?: string; file?: string } = {}
    if (!fairName.trim()) errors.name = 'Fair name is required.'
    if (!fairDate)        errors.date = 'Fair date is required.'
    if (!file)            errors.file = 'Please select an .xlsx file.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setResult(null)

    if (!validate()) return
    if (!authHeader) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('name', fairName.trim())
      formData.append('date', fairDate)
      formData.append('file', file!)

      const importResult = await adminApi.importOfflineFair(authHeader, formData)
      setResult(importResult)
      // Notify parent (e.g., to refresh the fair list dropdown)
      onImportSuccess?.()
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Import failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Import Offline Fair
      </Typography>

      {result ? (
        <Box>
          <ImportSuccessSummary result={result} />
          <Button
            sx={{ mt: 2 }}
            variant="outlined"
            onClick={() => {
              setResult(null)
              setFairName('')
              setFairDate('')
              setFile(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          >
            Import Another Fair
          </Button>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
            {/* Fair Name */}
            <TextField
              label="Fair Name"
              value={fairName}
              onChange={e => { setFairName(e.target.value); setFieldErrors(fe => ({ ...fe, name: undefined })) }}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name}
              required
              fullWidth
              disabled={submitting}
            />

            {/* Fair Date */}
            <TextField
              label="Fair Date"
              type="date"
              value={fairDate}
              onChange={e => { setFairDate(e.target.value); setFieldErrors(fe => ({ ...fe, date: undefined })) }}
              error={!!fieldErrors.date}
              helperText={fieldErrors.date}
              required
              fullWidth
              disabled={submitting}
              InputLabelProps={{ shrink: true }}
            />

            {/* File Upload */}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#1D1D1F', fontWeight: 500 }}>
                Inventory File (.xlsx) <span style={{ color: '#C62828' }}>*</span>
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                disabled={submitting}
                style={{ display: 'block', marginBottom: 4 }}
              />
              {fileError && (
                <Typography variant="caption" color="error">{fileError}</Typography>
              )}
              {fieldErrors.file && !file && (
                <Typography variant="caption" color="error">{fieldErrors.file}</Typography>
              )}
              {file && (
                <Typography variant="caption" sx={{ color: '#2E7D32' }}>
                  Selected: {file.name}
                </Typography>
              )}
            </Box>

            {/* Server error */}
            {serverError && (
              <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{serverError}</Alert>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{ alignSelf: 'flex-start' }}
            >
              {submitting
                ? <><CircularProgress size={18} sx={{ mr: 1, color: 'inherit' }} /> Importing…</>
                : 'Import Fair'}
            </Button>
          </Box>
        </Box>
      )}

      <Divider sx={{ mt: 3 }} />
    </Box>
  )
}
