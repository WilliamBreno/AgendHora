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
