export function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Serviços com preço variável (ex: depende do cabelo, do procedimento
// escolhido na hora) mostram "A partir de R$X" em vez de um valor fechado.
export function formatarPrecoServico(preco: number, aPartir: boolean) {
  return aPartir ? `A partir de ${formatarPreco(preco)}` : formatarPreco(preco)
}

export function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`
  const horas = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `${horas}h` : `${horas}h${resto}min`
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
