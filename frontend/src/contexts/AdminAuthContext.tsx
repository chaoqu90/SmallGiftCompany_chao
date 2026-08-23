import { createContext, useContext, useState } from 'react'

interface AdminAuthContextValue {
  authHeader: string | null
  login: (username: string, password: string) => void
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

const SESSION_KEY = 'adminCredentials'

function storedHeader(): string | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  return raw ? `Basic ${raw}` : null
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [authHeader, setAuthHeader] = useState<string | null>(storedHeader)

  function login(username: string, password: string) {
    const encoded = btoa(`${username}:${password}`)
    sessionStorage.setItem(SESSION_KEY, encoded)
    setAuthHeader(`Basic ${encoded}`)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthHeader(null)
  }

  return (
    <AdminAuthContext.Provider value={{ authHeader, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
