export const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

export const DIAS_SEMANA_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export const DIAS_SEMANA_EXTENSO_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
]

export interface DiaCalendario {
  data: string // "YYYY-MM-DD"
  dia: number
  noMesAtual: boolean
  hoje: boolean
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

/** mes é 0-indexado (0 = Janeiro), como no Date nativo. */
export function paraISODate(ano: number, mes: number, dia: number) {
  return `${ano}-${pad2(mes + 1)}-${pad2(dia)}`
}

export function dataDeHoje() {
  const hoje = new Date()
  return { ano: hoje.getFullYear(), mes: hoje.getMonth(), dia: hoje.getDate() }
}

/** Grade fixa de 6 semanas x 7 dias, começando no domingo da semana do dia 1. */
export function gerarGradeMensal(ano: number, mes: number): DiaCalendario[][] {
  const hoje = dataDeHoje()
  const primeiroDia = new Date(ano, mes, 1)
  const cursor = new Date(ano, mes, 1 - primeiroDia.getDay())

  const semanas: DiaCalendario[][] = []
  for (let semana = 0; semana < 6; semana++) {
    const linha: DiaCalendario[] = []
    for (let dia = 0; dia < 7; dia++) {
      linha.push({
        data: paraISODate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
        dia: cursor.getDate(),
        noMesAtual: cursor.getMonth() === mes,
        hoje:
          cursor.getFullYear() === hoje.ano &&
          cursor.getMonth() === hoje.mes &&
          cursor.getDate() === hoje.dia,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    semanas.push(linha)
  }
  return semanas
}

export function formatarMesAno(ano: number, mes: number) {
  return `${MESES_PT[mes]} de ${ano}`
}

export function descricaoHojePorExtenso() {
  const hoje = new Date()
  return `Hoje é ${DIAS_SEMANA_EXTENSO_PT[hoje.getDay()]}, dia ${hoje.getDate()}`
}

export function ehMesAtual(ano: number, mes: number) {
  const hoje = dataDeHoje()
  return ano === hoje.ano && mes === hoje.mes
}
