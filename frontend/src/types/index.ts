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
  // preco null = sem preço cadastrado — página pública mostra "a combinar"
  // (ver CLAUDE.md "Segmentos de negócio").
  preco: number | null
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
  preco: number | null
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
  cliente_id: number
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
  pago: boolean
  // valor_final (opcional) sobrescreve o preço do serviço no faturamento —
  // vale pra qualquer estabelecimento, não só quem usa segmento "tatuagem"
  // (ver CLAUDE.md "Segmentos de negócio"). Só editável pelo admin.
  valor_final: number | null
  // valor_sinal + sinal_pago são o depósito antecipado. Só editáveis pelo admin.
  valor_sinal: number | null
  sinal_pago: boolean
  // link_referencia é texto simples (não upload) — o cliente cola no
  // formulário público, ou o admin edita depois pelo painel de detalhe.
  link_referencia: string
  // concluido_em: quando o atendimento terminou de verdade (botão "Concluir
  // agora"), null até então — ver CLAUDE.md "Encaixe de horários".
  concluido_em: string | null
  estabelecimento_id: number
  created_at: string
  updated_at: string
}

// Detalhe de conflito devolvido no corpo do 409 (ver CLAUDE.md "Encaixe de
// horários") — qual agendamento existente esbarra no horário escolhido.
export interface ConflitoAgendamento {
  cliente_nome: string
  servico_nome: string
  inicio: string // "HH:MM"
  fim: string // "HH:MM"
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
  link_referencia?: string
  // ignorados pelo backend quando a requisição não vem do admin (ver
  // CLAUDE.md "Segmentos de negócio") — presentes aqui só pro formulário
  // do admin conseguir mandar.
  valor_final?: number | null
  valor_sinal?: number | null
  sinal_pago?: boolean
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

// Bloqueio marca um período indisponível pra agendar (folga, almoço,
// feriado). hora_inicio/hora_fim vazios (os dois) = dia inteiro.
// profissional_id nulo = bloqueia o estabelecimento inteiro.
export interface Bloqueio {
  id: number
  data: string // "YYYY-MM-DD"
  hora_inicio: string
  hora_fim: string
  motivo: string
  profissional_id: number | null
  profissional_nome: string
  created_at: string
}

export interface BloqueioInput {
  data: string
  hora_inicio: string
  hora_fim: string
  motivo: string
  profissional_id: number | null
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
  aviso_cor_texto: string
  aviso_cor_fundo: string
  // plano é sempre "padrao" hoje (plano único) — guardado desde já pra não
  // exigir migration quando outros planos forem definidos.
  plano: string
  // segmento controla o que aparece em destaque nas telas (hoje: "geral" ou
  // "tatuagem", que mostra sinal + link de referência em destaque no
  // painel do agendamento) — trocado direto no banco pelo dono do
  // projeto, não é self-service nesta v1 (ver CLAUDE.md "Segmentos de
  // negócio").
  segmento: string
  // ativo controla o acesso enquanto a cobrança InfinitePay não confirma —
  // ver CLAUDE.md "Cadastro e ativação de novos estabelecimentos" e o
  // middleware ExigirEstabelecimentoAtivo no backend, que bloqueia admin e
  // página pública quando false.
  ativo: boolean
  // isento marca quem nunca deve ser cobrado (uso pessoal do dono do
  // projeto) — quando true, a tela "Meu Plano" mostra só "acesso gratuito"
  // e nem o banner de vencimento nem proximo_vencimento fazem sentido.
  isento: boolean
  isento_ate: string | null
  // proximo_vencimento é sempre "data do último pagamento + 30 dias" — nulo
  // pra quem é isento ou pra contas ativas anteriores à cobrança automática
  // que nunca passaram pelo fluxo de pagamento (ver CLAUDE.md "Renovação
  // mensal").
  proximo_vencimento: string | null
  // link_pagamento_url é o link InfinitePay do ciclo de cobrança atual —
  // vazio quando isento, já pago, ou quando ainda não foi gerado.
  link_pagamento_url: string
  // desconto padrão (0-100) aplicado automaticamente quando um profissional
  // compra um produto internamente — null = nenhum desconto configurado,
  // continua editável por venda (ver CLAUDE.md "Cadastro de produtos").
  desconto_profissional_percentual: number | null
  created_at: string
  updated_at: string
}

// Resposta da rota pública /api/pagamento/:slug (tela pós-cadastro) —
// deliberadamente mais enxuta que Estabelecimento inteiro, já que essa rota
// não exige login.
export interface PagamentoStatus {
  ativo: boolean
  isento: boolean
  link_pagamento_url: string
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
  aviso_cor_texto: string
  aviso_cor_fundo: string
  // segmento decide se o formulário público mostra o campo de link de
  // referência (só quando "tatuagem" — ver CLAUDE.md "Segmentos de negócio").
  segmento: string
}

export interface PeriodoMetricas {
  agendamentos: number
  faturamento: number
  recebido: number
  a_receber: number
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

// EmailIsento é a lista global de e-mails isentos de pagamento (uso pessoal
// do dono do projeto, gerenciada em /plataforma — ver CLAUDE.md "Isenção de
// pagamento"). estabelecimento_id fica nulo até o e-mail ser usado num
// cadastro.
// DuracaoIsencao é por quantos dias o acesso fica liberado a partir do
// cadastro — null significa "sempre" (isenção permanente).
export type DuracaoIsencao = 7 | 15 | 30 | null

export interface EmailIsento {
  id: number
  email: string
  duracao_dias: DuracaoIsencao
  estabelecimento_id: number | null
  estabelecimento_nome: string
  // isento_ate só vem preenchido depois que o e-mail foi usado num
  // cadastro — null enquanto não foi usado, ou se a isenção é "sempre".
  isento_ate: string | null
  created_at: string
}

export interface Cliente {
  id: number
  nome: string
  telefone: string
  email: string
  // "YYYY-MM-DD" ou null — nem todo cliente tem (nasce sem, a partir de um
  // agendamento; só existe se cadastrado/editado manualmente ou importado).
  data_nascimento: string | null
  agendamentos_count: number
  // "YYYY-MM-DD" do último agendamento confirmado, ou null se nunca agendou.
  ultimo_agendamento_em: string | null
  // sumido = já agendou alguma vez mas não agenda há mais de 60 dias (ver
  // CLAUDE.md "Clientes") — nunca true pra quem nunca agendou.
  sumido: boolean
  created_at: string
}

export interface ClienteInput {
  nome: string
  telefone: string
  data_nascimento: string | null
}

export interface ImportacaoClientesResultado {
  criados: number
  atualizados: number
  total: number
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
  // Métricas de produtos — só vêm preenchidas pro dono (ver CLAUDE.md
  // "Cadastro de produtos"): auxiliar recebe tudo zerado, porque venda de
  // produto pro cliente final não tem profissional atribuído. Só contam
  // vendas pra cliente final — compra interna de profissional não entra em
  // faturamento.
  produtos_hoje: ProdutosMetricas
  produtos_semana: ProdutosMetricas
  produtos_mes: ProdutosMetricas
  produtos_mais_vendidos: ProdutoRankingItem[]
}

export interface ProdutosMetricas {
  quantidade: number
  faturamento: number
  // lucro só soma quando o produto tem custo_unitario cadastrado.
  lucro: number
}

export interface ProdutoRankingItem {
  produto_id: number
  nome: string
  quantidade: number
  faturamento: number
}

// Produto do catálogo interno — precificação e controle de estoque básicos
// (ver CLAUDE.md "Cadastro de produtos").
export interface Produto {
  id: number
  nome: string
  preco: number
  // custo_unitario é opcional — só quem quiser acompanhar lucro cadastra.
  custo_unitario: number | null
  quantidade_estoque: number
  // estoque_minimo = 0 desativa o alerta de estoque baixo pra esse produto.
  estoque_minimo: number
  // ativo=false = descontinuado (soft-disable) — some do fluxo de venda mas
  // mantém o histórico de vendas antigas intacto.
  ativo: boolean
  descricao: string
  foto: string
  estabelecimento_id: number
  created_at: string
  updated_at: string
}

export interface ProdutoInput {
  nome: string
  preco: number
  custo_unitario: number | null
  quantidade_estoque: number
  estoque_minimo: number
  ativo?: boolean
  descricao: string
  foto: string
}

export type TipoCompradorVenda = "cliente" | "profissional"

// VendaProduto registra a saída de um produto do estoque, pro cliente final
// (avulsa ou junto de um agendamento) ou pra compra interna de um
// profissional (com desconto opcional) — ver CLAUDE.md "Cadastro de produtos".
// cliente/profissional só vêm preenchidos quando cliente_id/profissional_id
// não são nulos (preload condicional do GORM).
export interface VendaProduto {
  id: number
  produto_id: number
  produto: Produto
  quantidade: number
  preco_unitario: number
  valor_total: number
  tipo_comprador: TipoCompradorVenda
  cliente_id: number | null
  cliente?: Pick<Cliente, "id" | "nome" | "telefone">
  agendamento_id: number | null
  profissional_id: number | null
  profissional?: Pick<Usuario, "id" | "nome">
  percentual_desconto: number | null
  valor_desconto: number
  pago: boolean
  cancelada: boolean
  observacoes: string
  estabelecimento_id: number
  created_at: string
  updated_at: string
}

export interface VendaProdutoInput {
  produto_id: number
  quantidade: number
  tipo_comprador: TipoCompradorVenda
  // usados quando tipo_comprador = "cliente" e não há agendamento vinculado.
  agendamento_id?: number | null
  cliente_nome?: string
  cliente_telefone?: string
  // usado quando tipo_comprador = "profissional".
  profissional_id?: number | null
  // sobrescrevem o padrão do produto/estabelecimento quando informados.
  preco_unitario?: number | null
  percentual_desconto?: number | null
  observacoes?: string
}
