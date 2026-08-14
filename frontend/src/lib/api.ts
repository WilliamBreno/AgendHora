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
  // corpo bruto da resposta de erro — usado quando o backend manda dados
  // extras além da mensagem (ex: "conflito" no 409 de horário ocupado, ver
  // CLAUDE.md "Encaixe de horários").
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
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
    throw new ApiError(message, response.status, body)
  }

  return body as T
}

// api: chamadas sem contexto de empresa nem token (auth e convites de
// profissional — quem acessa ainda não tem sessão).
export const api = {
  get: <T>(path: string) => request<T>(path),
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
    if (err instanceof ApiError && (err.status === 401 || err.status === 402)) {
      clearToken()
      // 401: sessão inválida/expirada, volta pro login. 402: conta
      // desativada por inadimplência (ver auth.ExigirEstabelecimentoAtivo
      // no backend) — expulsa pra uma tela própria, não o login normal.
      const destino = err.status === 402 ? "/conta-inativa" : "/login"
      if (!window.location.pathname.startsWith(destino)) {
        window.location.href = destino
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

// baixarArquivoAdmin é pra respostas que não são JSON (ex: exportação CSV) —
// o helper `request` acima sempre tenta `.json()`, então essa rota precisa
// de um caminho próprio: busca com o Bearer token, pega como blob e dispara
// o download no navegador via um link temporário.
export async function baixarArquivoAdmin(path: string, nomeArquivo: string) {
  const token = getToken()
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(body?.error ?? `Erro ${response.status} ao exportar`, response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// enviarArquivoAdmin é pra rotas que recebem upload (ex: importação de
// clientes) — precisa de multipart/form-data, então não passa pelo
// `request` acima (que sempre manda Content-Type: application/json).
export async function enviarArquivoAdmin<T>(path: string, campo: string, arquivo: File): Promise<T> {
  const token = getToken()
  const formData = new FormData()
  formData.append(campo, arquivo)

  const response = await fetch(`${API_URL}/api/admin${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Erro ${response.status} ao enviar arquivo`, response.status)
  }
  return body as T
}

const TOKEN_PLATAFORMA_KEY = "agendhora_plataforma_token"

export function getTokenPlataforma() {
  return localStorage.getItem(TOKEN_PLATAFORMA_KEY)
}

export function setTokenPlataforma(token: string) {
  localStorage.setItem(TOKEN_PLATAFORMA_KEY, token)
}

export function clearTokenPlataforma() {
  localStorage.removeItem(TOKEN_PLATAFORMA_KEY)
}

// apiPlataforma: uso pessoal do dono do projeto (ver CLAUDE.md "Isenção de
// pagamento") — guarda o token num localStorage próprio, à parte do
// `agendhora_token` do admin de estabelecimento, pra não ter nenhuma
// chance de um se passar pelo outro no frontend (o backend já garante isso
// à parte, mas mantém os dois isolados dos dois lados).
async function requestPlataforma<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getTokenPlataforma()
  try {
    return await request<T>(`/api/plataforma${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearTokenPlataforma()
      if (!window.location.pathname.startsWith("/plataforma/login")) {
        window.location.href = "/plataforma/login"
      }
    }
    throw err
  }
}

export const apiPlataforma = {
  post: <T>(path: string, data: unknown) =>
    requestPlataforma<T>(path, { method: "POST", body: JSON.stringify(data) }),
  get: <T>(path: string) => requestPlataforma<T>(path),
  delete: <T>(path: string) => requestPlataforma<T>(path, { method: "DELETE" }),
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

// apiPagamento: tela pós-cadastro (ver CLAUDE.md "Cadastro e ativação de
// novos estabelecimentos") — sem login, de propósito: é exatamente enquanto
// o estabelecimento está inativo (sem sessão utilizável) que ela precisa
// funcionar. Identifica a empresa pelo slug, igual apiPublico.
export function apiPagamento(slug: string) {
  const base = `/api/pagamento/${slug}`
  return {
    get: <T>() => request<T>(base),
    post: <T>(path: string, data?: unknown) =>
      request<T>(`${base}${path}`, {
        method: "POST",
        body: data !== undefined ? JSON.stringify(data) : undefined,
      }),
  }
}
