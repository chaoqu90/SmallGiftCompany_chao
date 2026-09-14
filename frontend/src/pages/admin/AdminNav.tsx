import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

const NAV_LINKS = [
  { to: '/admin/orders',         label: 'Orders' },
  { to: '/admin/future-parties', label: 'Future Parties' },
  { to: '/admin/products',       label: 'Products' },
  { to: '/admin/bundles',        label: 'Bundles' },
  { to: '/admin/dashboard',      label: 'Dashboard' },
]

export function AdminNav() {
  const { logout } = useAdminAuth()
  const navigate   = useNavigate()
  const theme      = useTheme()
  const isMobile   = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/admin/login')
  }

  return (
    <Box sx={{ bgcolor: '#1D1D1F', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 3 }}>
      {/* Mobile: hamburger button — left of title */}
      {isMobile && (
        <IconButton
          size="small"
          onClick={() => setDrawerOpen(true)}
          sx={{ color: '#aaa', p: 0.5, mr: 0 }}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </IconButton>
      )}

      <Typography sx={{ color: '#fff', fontWeight: 700, mr: 2, fontSize: '0.9rem' }}>Admin</Typography>

      {/* Desktop: horizontal links */}
      {!isMobile && NAV_LINKS.map(({ to, label }) => (
        <Link key={to} to={to} style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.875rem' }}>
          {label}
        </Link>
      ))}

      <Box sx={{ flex: 1 }} />
      <Button size="small" onClick={handleLogout} sx={{ color: '#aaa', fontSize: '0.75rem' }}>Sign out</Button>

      {/* Mobile drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 240, pt: 1 }} role="presentation">
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#1D1D1F' }}>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Admin</Typography>
          </Box>
          <List>
            {NAV_LINKS.map(({ to, label }) => (
              <ListItem key={to} disablePadding>
                <ListItemButton
                  component={Link}
                  to={to}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ color: '#1D1D1F' }}
                >
                  <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.9rem' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  )
}
