import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

export function AdminGuard() {
  const { authHeader } = useAdminAuth()
  if (!authHeader) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
