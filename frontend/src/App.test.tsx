import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from './theme'
import App from './App'
import * as generatedBundlesApi from './api/generatedBundles'

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ session: null, user: null, loading: false }),
}))

vi.mock('./contexts/CartContext', () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => children,
  useCart: () => ({ sessionId: 'test-session', cartCount: 0, refreshCart: vi.fn(), setCartCount: vi.fn() }),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function renderApp(initialPath = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('App routing smoke tests', () => {
  it('renders the homepage hero on the root route', () => {
    renderApp('/')
    expect(
      screen.getByRole('heading', { name: /goodie bags/i }),
    ).toBeInTheDocument()
  })

  it('renders the Gift Finder panel on the root route', () => {
    renderApp('/')
    expect(screen.getByText(/let's find their favorites/i)).toBeInTheDocument()
  })

  it('renders BundleCustomizationPage loading state at /bundleCustomization/:id', () => {
    vi.spyOn(generatedBundlesApi, 'getGeneratedBundle').mockReturnValue(new Promise(() => {}))
    renderApp('/bundleCustomization/gb_test123456')
    expect(screen.getByTestId('configurator-loading')).toBeInTheDocument()
  })
})
