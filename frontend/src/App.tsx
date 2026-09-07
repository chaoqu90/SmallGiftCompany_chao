import { Outlet, Route, Routes } from 'react-router-dom'
import { Box } from '@mui/material'
import { HomePage }                from './pages/HomePage'
import { BundleCustomizationPage } from './pages/BundleCustomizationPage'
import { AdminAuthProvider }       from './contexts/AdminAuthContext'
import { AdminGuard }              from './pages/admin/AdminGuard'
import { AdminLoginPage }          from './pages/admin/AdminLoginPage'
import { AdminProductsPage }       from './pages/admin/AdminProductsPage'
import { AdminBundlesPage }        from './pages/admin/AdminBundlesPage'
import { AdminDashboardPage }      from './pages/admin/AdminDashboardPage'
import { AdminOrdersPage }         from './pages/admin/AdminOrdersPage'
import { AdminOrderDetailPage }    from './pages/admin/AdminOrderDetailPage'
import { AdminFuturePartiesPage }  from './pages/admin/AdminFuturePartiesPage'
import { AdminRedemptionPage }     from './pages/admin/AdminRedemptionPage'
// User-management routes (FEAT-001)
import { LoginPage }                    from './pages/LoginPage'
import { RegisterPage }                 from './pages/RegisterPage'
import { AuthCallbackPage }             from './pages/AuthCallbackPage'
import { ProfilePage }                  from './pages/ProfilePage'
import { EmailVerificationNoticePage }  from './pages/EmailVerificationNoticePage'
import { ProtectedRoute, GuestRoute }   from './components/ProtectedRoute'
// Cart & Order routes (FEAT-002)
import { CartPage }         from './pages/CartPage'
import { CheckoutPage }     from './pages/CheckoutPage'
import { OrdersPage }       from './pages/OrdersPage'
import { OrderDetailPage }  from './pages/OrderDetailPage'
import { NavBar }           from './components/NavBar'
import { Footer }          from './components/Footer'
// Payment routes (FEAT-003)
import { OrderConfirmationPage } from './pages/OrderConfirmationPage'
import { OrderSearchPage }       from './pages/OrderSearchPage'

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  )
}

/**
 * Root layout — wraps all non-admin routes with the NavBar (AC2.1).
 * The NavBar appears above the page content on every route.
 */
function RootLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  )
}

function App() {
  return (
    <Routes>
      {/* ── Routes with NavBar (all user-facing routes) ───────────────────── */}
      <Route element={<RootLayout />}>
        {/* Public routes */}
        <Route path="/"                              element={<HomePage />} />
        <Route path="/build"                         element={<HomePage />} />   {/* FEAT-005 AC5.1, AC5.2 — signup promotion path */}
        <Route path="/bundleCustomization/:bundleId" element={<BundleCustomizationPage />} />

        {/* User auth routes (FEAT-001) */}
        <Route path="/login"        element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register"     element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/verify-email"  element={<EmailVerificationNoticePage />} />
        <Route
          path="/profile"
          element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
        />

        {/* Cart & Order routes (FEAT-002) — cart/checkout/order detail are public */}
        <Route path="/cart"     element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route
          path="/orders"
          element={<ProtectedRoute><OrdersPage /></ProtectedRoute>}
        />
        <Route path="/orders/:publicId"    element={<OrderDetailPage />} />
        {/* Payment routes (FEAT-003) */}
        <Route path="/orders/confirmation" element={<OrderConfirmationPage />} />
        <Route path="/orders/search"       element={<OrderSearchPage />} />
      </Route>

      {/* ── Admin routes (own layout — no NavBar) ─────────────────────────── */}
      <Route element={<AdminLayout />}>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<AdminGuard />}>
          <Route path="/admin/products"        element={<AdminProductsPage />} />
          <Route path="/admin/bundles"         element={<AdminBundlesPage />} />
          <Route path="/admin/dashboard"       element={<AdminDashboardPage />} />
          <Route path="/admin/orders"          element={<AdminOrdersPage />} />
          <Route path="/admin/orders/:publicId" element={<AdminOrderDetailPage />} />
          <Route path="/admin/future-parties"  element={<AdminFuturePartiesPage />} />
          <Route path="/admin/redemption"      element={<AdminRedemptionPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
