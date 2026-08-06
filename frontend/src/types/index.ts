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
  preco_a_partir: boolean
  duracao_min: number
  descricao: string
  cor: CorServico
  icone: string
  foto: string
  estabelecimento_id: number
  created_at: string
  updated_at: string
}

export interface ServicoInput {
  nome: string
  preco: number
  preco_a_partir: boolean
  duracao_min: number
  descricao: string
  cor: CorServico
  icone: string
  foto: string
}

export type StatusAgendamento = "pendente" | "confirmado" | "cancelado"

export interface Agendamento {
  id: number
  cliente_nome: string
  cliente_telefone: string
  cliente_email: string
  servico_id: number
  servico: Servico
  profissional_id: number
  profissional_nome: string
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
  cliente_email?: string
  servico_id: number
  profissional_id: number
  data: string
  hora: string
  observacoes: string
  encaixe?: boolean
}

// Papel do usuário logado — define o que ele pode acessar (ver CLAUDE.md,
// funcionalidade de profissional auxiliar).
export type PapelUsuario = "dono" | "auxiliar"

export interface Usuario {
  id: number
  nome: string
  email: string
  telefone: string
  papel: PapelUsuario
  estabelecimento_id: number
  horario_trabalho: HorarioFuncionamento
  created_at: string
  updated_at: string
}

// Profissional agendável exposto na página pública (o cliente escolhe quem
// vai atender) — só o essencial, nada sensível.
export interface ProfissionalPublico {
  id: number
  nome: string
}

export interface ConvitePendente {
  id: number
  email: string
  telefone: string
  link: string
  created_at: string
}

export interface Equipe {
  profissionais: Usuario[]
  convites_pendentes: ConvitePendente[]
}

// Chaves sem acento — precisam bater com models.DiasSemana no backend.
export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const

export type DiaSemana = (typeof DIAS_SEMANA)[number]

export interface HorarioDia {
  abre: string
  fecha: string
  fechado: boolean
  // Intervalo de descanso opcional (ex: almoço) — ambos vazios = sem intervalo.
  intervalo_inicio?: string
  intervalo_fim?: string
}

export type HorarioFuncionamento = Partial<Record<DiaSemana, HorarioDia>>

export interface Estabelecimento {
  id: number
  nome: string
  telefone: string
  endereco: string
  email: string
  slug: string
  logo: string
  horario_funcionamento: HorarioFuncionamento
  icones_padrao: string[]
  aviso_ativo: boolean
  aviso_texto: string
  created_at: string
  updated_at: string
}

export interface EstabelecimentoDadosInput {
  nome: string
  telefone: string
  endereco: string
  email: string
}

// O que a página pública recebe — sem e-mail nem outros dados internos do dono.
export interface EstabelecimentoPublico {
  nome: string
  slug: string
  logo: string
  telefone: string
  endereco: string
  aviso_ativo: boolean
  aviso_texto: string
}

export interface PeriodoMetricas {
  agendamentos: number
  faturamento: number
  ainda_vao_acontecer: number
}

export interface PontoGrafico {
  data: string
  valor: number
}

export interface RankingItem {
  servico_id: number
  nome: string
  cor: CorServico
  quantidade: number
  faturamento: number
}

export interface Sugestao {
  tipo: "alerta" | "incentivo"
  titulo: string
  descricao: string
}

export interface Dashboard {
  hoje: PeriodoMetricas
  semana: PeriodoMetricas
  mes: PeriodoMetricas
  grafico_7_dias: PontoGrafico[]
  grafico_30_dias: PontoGrafico[]
  ranking_quantidade: RankingItem[]
  ranking_faturamento: RankingItem[]
  sugestoes: Sugestao[]
}
