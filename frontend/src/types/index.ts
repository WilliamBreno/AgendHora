// Chaves da paleta fixa de 6 cores de serviço (ver CLAUDE.md — não são livres).
export const CORES_SERVICO = [
  "teal",
  "coral",
  "violeta",
  "ambar",
  "verde-salvia",
  "rosa",
] as const

export type CorServico = (typeof CORES_SERVICO)[number]

export interface Servico {
  id: number
  nome: string
  preco: number
  duracao_min: number
  descricao: string
  cor: CorServico
  icone: string
  estabelecimento_id: number
  created_at: string
  updated_at: string
}

export interface ServicoInput {
  nome: string
  preco: number
  duracao_min: number
  descricao: string
  cor: CorServico
  icone: string
}

export type StatusAgendamento = "pendente" | "confirmado" | "cancelado"

export interface Agendamento {
  id: number
  cliente_nome: string
  cliente_telefone: string
  servico_id: number
  servico: Servico
  data: string // "YYYY-MM-DD"
  hora: string // "HH:MM"
  status: StatusAgendamento
  observacoes: string
  encaixe: boolean
  estabelecimento_id: number
  created_at: string
  updated_at: string
}

export interface AgendamentoInput {
  cliente_nome: string
  cliente_telefone: string
  servico_id: number
  data: string
  hora: string
  observacoes: string
  encaixe?: boolean
}

export interface Estabelecimento {
  id: number
  nome: string
  telefone: string
  endereco: string
  horario_funcionamento: Record<string, unknown>
  icones_padrao: string[]
  created_at: string
  updated_at: string
}
