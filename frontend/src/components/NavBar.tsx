/**
 * NavBar — persistent top navigation bar visible on all pages.
 *
 * Cart icon is shown to ALL users (authenticated or not) with live badge.
 * The badge count comes from CartContext (session-based, no auth required).
 *
 * Authenticated state:
 *   - Cart icon with badge
 *   - Avatar IconButton (user initial) → profile dropdown menu
 *     with "Profile", "My Orders", "Sign Out"
 *
 * Unauthenticated state:
 *   - Cart icon with badge
 *   - "Sign In" and "Register" text buttons
 *
 * Loading state (auth check in progress):
 *   - Cart icon always visible
 *   - Skeleton placeholder for auth-dependent controls
 *
 * Requirements: R2 (AC2.1–AC2.8), R7 (AC7.1–AC7.3)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { supabase } from '../lib/supabaseClient'

export function NavBar() {
  const { session, loading } = useAuth()
  const { cartCount } = useCart()
  const navigate = useNavigate()

  // Profile menu anchor state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(menuAnchor)

  function openMenu(e: React.MouseEvent<HTMLElement>) {
    setMenuAnchor(e.currentTarget)
  }

  function closeMenu() {
    setMenuAnchor(null)
  }

  async function handleSignOut() {
    closeMenu()
    await supabase.auth.signOut()
    navigate('/')
  }

  // Derive the avatar initial from displayName or email (AC2.2)
  function getAvatarInitial(): string {
    if (!session) return ''
    const fullName = session.user.user_metadata?.full_name as string | undefined
    if (fullName && fullName.length > 0) return fullName[0].toUpperCase()
    const email = session.user.email ?? ''
    return email.length > 0 ? email[0].toUpperCase() : '?'
  }

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: '#F0E9DF' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* ── Left: App name / logo ────────────────────────────────────── */}
        <Typography
          variant="h6"
          component="button"
          onClick={() => navigate('/')}
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            color: '#1D1D1F',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            padding: 0,
            fontFamily: '"DM Sans", Inter, sans-serif',
          }}
        >
          SmallGift
        </Typography>

        {/* ── Right: cart icon (always) + auth-aware controls ──────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

          {/* Cart icon with badge — visible to ALL users (AC2.4, AC2.6) */}
          <Tooltip title="Cart">
            <IconButton
              onClick={() => navigate('/cart')}
              aria-label="Shopping cart"
              size="small"
            >
              <Badge
                badgeContent={cartCount}
                color="primary"
                showZero={false}
              >
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Loading state — skeleton so the bar doesn't flicker (AC2.8) */}
          {loading && (
            <>
              <Skeleton variant="circular" width={36} height={36} />
            </>
          )}

          {/* Authenticated state (AC2.2–AC2.6) */}
          {!loading && session && (
            <>
              {/* Profile avatar → dropdown menu (AC2.2, AC2.3) */}
              <Tooltip title="Account">
                <IconButton onClick={openMenu} size="small" aria-label="Account menu">
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: '#F47F6B', fontSize: '0.875rem' }}
                  >
                    {getAvatarInitial()}
                  </Avatar>
                </IconButton>
              </Tooltip>

              {/* Profile dropdown menu (AC2.3, AC7.1–AC7.3) */}
              <Menu
                anchorEl={menuAnchor}
                open={menuOpen}
                onClose={closeMenu}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem
                  onClick={() => { closeMenu(); navigate('/profile') }}
                >
                  Profile
                </MenuItem>
                <MenuItem
                  onClick={() => { closeMenu(); navigate('/orders') }}
                >
                  My Orders
                </MenuItem>
                <MenuItem onClick={handleSignOut}>
                  Sign Out
                </MenuItem>
              </Menu>
            </>
          )}

          {/* Unauthenticated state (AC2.7) */}
          {!loading && !session && (
            <>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/login')}
                sx={{ color: '#1D1D1F' }}
              >
                Sign In
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/register')}
              >
                Register
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
