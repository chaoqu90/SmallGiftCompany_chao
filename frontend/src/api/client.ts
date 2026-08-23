const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type ApiError = {
  status: number
  message: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.method && init.method !== 'GET' && init.method !== 'HEAD'
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error: ApiError = {
      status: res.status,
      message: (body as { detail?: string }).detail ?? res.statusText,
    }
    throw error
  }
  return res.json() as Promise<T>
}

export const api = {
  get:  <T>(path: string)                    => request<T>(path),
  post: <T>(path: string, body: unknown)     => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}
