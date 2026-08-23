import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminAuthProvider } from '../../contexts/AdminAuthContext'
import { AdminLoginPage } from './AdminLoginPage'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/products" element={<div data-testid="admin-products" />} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('AdminLoginPage', () => {
  it('renders login form', () => {
    renderLogin()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response)
    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i))
  })

  it('navigates to /admin/products on successful login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response)
    renderLogin()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'changeme' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByTestId('admin-products')).toBeInTheDocument())
  })
})
