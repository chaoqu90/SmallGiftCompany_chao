import { describe, it, expect, vi, afterEach } from 'vitest'
import { api } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helper ──────────────────────────────────────────────────────────────────

function stubFetch(overrides: {
  ok: boolean
  status?: number
  statusText?: string
  json?: () => Promise<unknown>
}) {
  const mock = vi.fn().mockResolvedValue({
    ok: overrides.ok,
    status: overrides.status ?? (overrides.ok ? 200 : 500),
    statusText: overrides.statusText ?? (overrides.ok ? 'OK' : 'Internal Server Error'),
    json: overrides.json ?? (() => Promise.resolve({})),
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

// ── Happy path ───────────────────────────────────────────────────────────────

describe('api.get — success', () => {
  it('returns parsed JSON body on 200', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({ status: 'UP' }) })
    const result = await api.get<{ status: string }>('/api/health')
    expect(result.status).toBe('UP')
  })
})

// ── Error shape ──────────────────────────────────────────────────────────────

describe('api.get — error responses', () => {
  it('uses detail field as message when server returns ProblemDetail', async () => {
    // Spring's GlobalExceptionHandler emits {"detail":"…"} — client must surface it.
    stubFetch({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ detail: 'name: must not be blank' }),
    })
    await expect(api.get('/any')).rejects.toMatchObject({
      status: 400,
      message: 'name: must not be blank',
    })
  })

  it('falls back to statusText when error body has no detail field', async () => {
    // A non-Spring 500 from nginx/load-balancer may return a different shape.
    stubFetch({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: () => Promise.resolve({ title: 'Unexpected shape' }),
    })
    await expect(api.get('/any')).rejects.toMatchObject({
      status: 503,
      message: 'Service Unavailable',
    })
  })

  it('falls back to statusText when error body is not JSON at all', async () => {
    // A reverse proxy returning an HTML error page must not crash the client.
    stubFetch({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })
    await expect(api.get('/any')).rejects.toMatchObject({
      status: 502,
      message: 'Bad Gateway',
    })
  })

  it('falls back to statusText when error body is empty string', async () => {
    stubFetch({
      ok: false,
      status: 504,
      statusText: 'Gateway Timeout',
      json: () => Promise.reject(new SyntaxError('empty')),
    })
    await expect(api.get('/any')).rejects.toMatchObject({
      status: 504,
      message: 'Gateway Timeout',
    })
  })
})

// ── Malformed success response ────────────────────────────────────────────────

describe('api.get — malformed success response', () => {
  it('propagates SyntaxError when 200 body is not valid JSON', async () => {
    // A misconfigured reverse proxy can return an HTML page with HTTP 200.
    // The client does not mask this — callers must handle it (e.g., show "unavailable").
    // This test documents the current contract so a future change is deliberate.
    stubFetch({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    })
    await expect(api.get('/api/health')).rejects.toBeInstanceOf(SyntaxError)
  })
})

// ── Request hygiene ───────────────────────────────────────────────────────────

describe('api.get — request construction', () => {
  it('does not send Content-Type header on GET requests', async () => {
    // GET requests have no body; sending Content-Type can trigger CORS preflight
    // for no benefit, and some strict servers reject it.
    const fetchMock = stubFetch({ ok: true })
    await api.get('/api/health')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('calls fetch exactly once — no hidden retry on success', async () => {
    const fetchMock = stubFetch({ ok: true })
    await api.get('/api/health')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('calls fetch exactly once — no hidden retry on error', async () => {
    // Automatic retries on error would cause duplicate side-effectful requests
    // (e.g., double-submitting an order) in future phases.
    const fetchMock = stubFetch({ ok: false, status: 500 })
    await api.get('/any').catch(() => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
