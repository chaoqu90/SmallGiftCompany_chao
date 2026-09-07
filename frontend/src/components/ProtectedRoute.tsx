/**
 * ProtectedRoute — guards routes that require an authenticated, email-verified session.
 *
 * While the auth state is loading:         show a centred CircularProgress spinner.
 * If no session:                           redirect to /login.
 * If session but email not confirmed:      redirect to /verify-email.
 * Otherwise:                              render children (or <Outlet /> for nested routes).
 *
 * Requirements: R2 (AC2.4), R5 (AC5.4, AC5.5)
 */
import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children?: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!session.user.email_confirmed_at) {
    return <Navigate to="/verify-email" replace />
  }

  // Render children prop (element route) or Outlet (nested routes)
  return children ? <>{children}</> : <Outlet />
}

/**
 * GuestRoute — wraps /login and /register.
 * Redirects authenticated users directly to /profile so they are not shown
 * the sign-in form again.
 *
 * Requirements: R5 (AC5.4)
 */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (session) {
    return <Navigate to="/profile" replace />
  }

  return <>{children}</>
}
