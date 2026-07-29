const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080"

const TOKEN_KEY = "agendhora_token"

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.error ?? `Erro ${response.status} ao chamar a API`
    throw new ApiError(message, response.status)
  }

  return body as T
}

// api: chamadas sem contexto de empresa (hoje só /api/auth/*).
export const api = {
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
}

async function requestAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  try {
    return await request<T>(`/api/admin${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken()
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    throw err
  }
}

// apiAdmin: área logada do dono — sempre manda o Bearer token e desloga
// sozinho se a sessão expirar (401).
export const apiAdmin = {
  get: <T>(path: string) => requestAdmin<T>(path),
  post: <T>(path: string, data: unknown) =>
    requestAdmin<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    requestAdmin<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    requestAdmin<T>(path, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(path: string) => requestAdmin<T>(path, { method: "DELETE" }),
}

// apiPublico: página de agendamento do cliente — nunca precisa de login,
// só sabe de qual empresa é o pedido pelo slug na URL.
export function apiPublico(slug: string) {
  const base = `/api/publico/${slug}`
  return {
    get: <T>(path: string) => request<T>(`${base}${path}`),
    post: <T>(path: string, data: unknown) =>
      request<T>(`${base}${path}`, { method: "POST", body: JSON.stringify(data) }),
    patch: <T>(path: string, data?: unknown) =>
      request<T>(`${base}${path}`, {
        method: "PATCH",
        body: data !== undefined ? JSON.stringify(data) : undefined,
      }),
  }
}
