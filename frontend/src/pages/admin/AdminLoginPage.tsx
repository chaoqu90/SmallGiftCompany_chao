import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, TextField, Typography, Alert } from '@mui/material'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

export function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const encoded = btoa(`${username}:${password}`)
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? ''}/admin/api/dashboard/`,
        { headers: { Authorization: `Basic ${encoded}` } }
      )
      if (res.status === 401) {
        setError('Invalid credentials')
        return
      }
      if (!res.ok) {
        setError('Server error — try again')
        return
      }
      login(username, password)
      navigate('/admin/products')
    } catch {
      setError('Could not reach server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F7F7F5' }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ bgcolor: '#fff', p: 4, borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', width: 320 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>Admin Login</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Username" value={username} onChange={e => setUsername(e.target.value)} fullWidth sx={{ mb: 2 }} size="small" autoComplete="username" />
        <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth sx={{ mb: 3 }} size="small" autoComplete="current-password" />
        <Button type="submit" variant="contained" fullWidth disabled={loading || !username || !password}
          sx={{ backgroundColor: '#F47F6B', '&:hover': { backgroundColor: '#e06b57' } }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>
    </Box>
  )
}
