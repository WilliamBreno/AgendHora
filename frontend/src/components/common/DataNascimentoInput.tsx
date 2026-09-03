import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataNascimentoInputProps {
  value: string | null // "YYYY-MM-DD" ou null
  onChange: (valor: string | null) => void
}

const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
]
const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
const MESES = MESES_ABREV.map((_, i) => String(i + 1).padStart(2, "0"))
const ANO_ATUAL = new Date().getFullYear()
// 110 anos cobre qualquer cliente vivo hoje, sem precisar de um "buscar ano"
const ANOS = Array.from({ length: 110 }, (_, i) => String(ANO_ATUAL - i))

// Três selects (dia/mês/ano) em vez de calendário ou <input type="date">
// nativo — mesmo padrão já usado pro campo de horário (ver HoraInput):
// funciona igual em qualquer navegador/celular, e navegar décadas pra trás
// (data de nascimento) seria muito lento num calendário mês a mês.
export function DataNascimentoInput({ value, onChange }: DataNascimentoInputProps) {
  // estado próprio (não só derivado de `value`) — cada select dispara
  // onValueChange separado, e só chamamos onChange do pai quando os três
  // já foram escolhidos. Sem estado local, a seleção de dia/mês fica presa
  // num loop: `value` só muda quando os três já estão completos, então
  // ler dia/mês/ano direto de `value` a cada render nunca vê a escolha
  // anterior (o pai nunca soube que o dia tinha sido escolhido).
  const [dia, setDia] = useState("")
  const [mes, setMes] = useState("")
  const [ano, setAno] = useState("")

  useEffect(() => {
    const [a, m, d] = value ? value.split("-") : ["", "", ""]
    setAno(a ?? "")
    setMes(m ?? "")
    setDia(d ?? "")
  }, [value])

  function atualizar(novoDia: string, novoMes: string, novoAno: string) {
    setDia(novoDia)
    setMes(novoMes)
    setAno(novoAno)
    if (novoDia && novoMes && novoAno) {
      onChange(`${novoAno}-${novoMes}-${novoDia}`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={dia} onValueChange={(v) => atualizar(v ?? "", mes, ano)}>
        <SelectTrigger className="w-[4.5rem]">
          <SelectValue placeholder="Dia">{(v: string | null) => v || "Dia"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DIAS.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={mes} onValueChange={(v) => atualizar(dia, v ?? "", ano)}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Mês">
            {(v: string | null) => (v ? MESES_ABREV[Number(v) - 1] : "Mês")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m, i) => (
            <SelectItem key={m} value={m}>
              {MESES_ABREV[i]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={ano} onValueChange={(v) => atualizar(dia, mes, v ?? "")}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Ano">{(v: string | null) => v || "Ano"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ANOS.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(dia || mes || ano) && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setDia("")
            setMes("")
            setAno("")
            onChange(null)
          }}
        >
          <X className="size-4" />
          <span className="sr-only">Limpar data de nascimento</span>
        </Button>
      )}
    </div>
  )
}
