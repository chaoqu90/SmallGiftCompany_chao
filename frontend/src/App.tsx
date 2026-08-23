import { Outlet, Route, Routes } from 'react-router-dom'
import { HomePage }                from './pages/HomePage'
import { BundleCustomizationPage } from './pages/BundleCustomizationPage'
import { AdminAuthProvider }       from './contexts/AdminAuthContext'
import { AdminGuard }              from './pages/admin/AdminGuard'
import { AdminLoginPage }          from './pages/admin/AdminLoginPage'
import { AdminProductsPage }       from './pages/admin/AdminProductsPage'
import { AdminBundlesPage }        from './pages/admin/AdminBundlesPage'
import { AdminDashboardPage }      from './pages/admin/AdminDashboardPage'

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/"                              element={<HomePage />} />
      <Route path="/bundleCustomization/:bundleId" element={<BundleCustomizationPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/admin/login"     element={<AdminLoginPage />} />
        <Route element={<AdminGuard />}>
          <Route path="/admin/products"  element={<AdminProductsPage />} />
          <Route path="/admin/bundles"   element={<AdminBundlesPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
