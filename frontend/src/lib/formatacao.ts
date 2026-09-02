export function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Serviços com preço variável (ex: depende do cabelo, do procedimento
// escolhido na hora) mostram "A partir de R$X" em vez de um valor fechado.
// Sem preço cadastrado (null), mostra "A combinar" — ver CLAUDE.md
// "Segmentos de negócio".
export function formatarPrecoServico(preco: number | null, aPartir: boolean) {
  if (preco === null) return "A combinar"
  return aPartir ? `A partir de ${formatarPreco(preco)}` : formatarPreco(preco)
}

export function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`
  const horas = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `${horas}h` : `${horas}h${resto}min`
}

// Serviços com duração variável (ver CLAUDE.md "Duração variável de
// serviço") mostram "de X a Y" no lugar de uma duração fixa.
export function formatarDuracaoServico(min: number, maxMin: number | null) {
  if (maxMin === null || maxMin <= min) return formatarDuracao(min)
  return `de ${formatarDuracao(min)} a ${formatarDuracao(maxMin)}`
}

// duracaoEfetivaMin espelha models.Servico.DuracaoEfetivaMin do backend — a
// duração que de fato bloqueia a agenda (o teto da faixa, quando o serviço
// tem duração variável, nunca o mínimo). Usada pra somar a duração de um
// combo de serviços antes de consultar disponibilidade (ver CLAUDE.md
// "Agendamento com mais de um serviço").
export function duracaoEfetivaMin(servico: { duracao_min: number; duracao_max_min: number | null }) {
  if (servico.duracao_max_min !== null && servico.duracao_max_min > servico.duracao_min) {
    return servico.duracao_max_min
  }
  return servico.duracao_min
}

// precoTotalServicos soma o preço de uma lista de serviços — null se
// QUALQUER um deles não tiver preço cadastrado ("a combinar" pesa mais que
// qualquer soma parcial, pra nunca mostrar um valor incompleto). Espelha
// Agendamento.PrecoTotal do backend.
export function precoTotalServicos(servicos: { preco: number | null }[]): number | null {
  let total = 0
  for (const s of servicos) {
    if (s.preco === null) return null
    total += s.preco
  }
  return total
}

// formatarPrecoTotalServicos é o formatarPrecoServico de uma lista de
// serviços — mesma regra de "A combinar" quando algum não tem preço.
export function formatarPrecoTotalServicos(servicos: { preco: number | null }[]) {
  const total = precoTotalServicos(servicos)
  return total === null ? "A combinar" : formatarPreco(total)
}

// nomesServicos junta os nomes de uma lista de serviços — "Corte + Barba"
// em vez de mostrar só o principal quando o agendamento tem mais de um.
export function nomesServicos(servicos: { nome: string }[]) {
  return servicos.map((s) => s.nome).join(" + ")
}

// servicosCompativeis filtra a lista pra só mostrar o que pode ser
// combinado com o que já foi escolhido — um serviço individual (ver
// CLAUDE.md "Serviços individuais") só combina com o catálogo geral e com
// outros serviços individuais do MESMO profissional; nunca com o de um
// colega, senão o combo ficaria impossível de atender num horário só.
// Usada tanto na página pública quanto no "Novo agendamento" do admin.
export function servicosCompativeis<T extends { id: number; profissional_id: number | null }>(
  servicos: T[],
  selecionados: T[]
): T[] {
  const profissionalExigido = selecionados.find((s) => s.profissional_id !== null)?.profissional_id
  if (profissionalExigido === undefined) return servicos
  return servicos.filter((s) => s.profissional_id === null || s.profissional_id === profissionalExigido)
}

export function formatarDataExibicao(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number)
  const texto = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const FUSO_BRASIL = "America/Sao_Paulo"

// dataCivilBrasil devolve "YYYY-MM-DD" pro dia civil no fuso do Brasil,
// não importa em que fuso o navegador de quem acessa está — usada pra
// comparações de vencimento que não podem depender de hora exata nem do
// fuso local de cada visitante (ver CLAUDE.md "Renovação mensal").
function dataCivilBrasil(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASIL }).format(data)
}

export function formatarDataCurta(dataISO: string) {
  const [ano, mes, dia] = dataCivilBrasil(new Date(dataISO)).split("-")
  return `${dia}/${mes}/${ano}`
}

// diasParaVencimento = proximo_vencimento - hoje, comparando só a data civil
// (dia/mês/ano) no fuso do Brasil, nunca a hora exata — garante que o
// resultado só muda uma vez a cada 24h, na virada do dia, não a cada
// refresh nem dependendo de que horas a pessoa acessou. É só uma conta feita
// na hora (não um gatilho de disparo único), então reaparece em todo acesso
// dentro da janela de aviso e continua valendo (negativo) depois do
// vencimento. Positivo = ainda faltam dias; 0 = vence hoje; negativo = venceu.
export function diasParaVencimento(proximoVencimentoISO: string): number {
  const hoje = new Date(`${dataCivilBrasil(new Date())}T00:00:00Z`)
  const vencimento = new Date(`${dataCivilBrasil(new Date(proximoVencimentoISO))}T00:00:00Z`)
  return Math.round((vencimento.getTime() - hoje.getTime()) / 86_400_000)
}
