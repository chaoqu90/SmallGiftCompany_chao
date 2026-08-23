import { Link, useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

export function AdminNav() {
  const { logout } = useAdminAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/admin/login')
  }

  return (
    <Box sx={{ bgcolor: '#1D1D1F', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 3 }}>
      <Typography sx={{ color: '#fff', fontWeight: 700, mr: 2, fontSize: '0.9rem' }}>Admin</Typography>
      {[
        { to: '/admin/products', label: 'Products' },
        { to: '/admin/bundles', label: 'Bundles' },
        { to: '/admin/dashboard', label: 'Dashboard' },
      ].map(({ to, label }) => (
        <Link key={to} to={to} style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.875rem' }}>{label}</Link>
      ))}
      <Box sx={{ flex: 1 }} />
      <Button size="small" onClick={handleLogout} sx={{ color: '#aaa', fontSize: '0.75rem' }}>Sign out</Button>
    </Box>
  )
}
