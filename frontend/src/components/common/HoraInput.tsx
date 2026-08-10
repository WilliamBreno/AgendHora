import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface HoraInputProps {
  id?: string
  // opcional porque HorarioDia.intervalo_inicio/intervalo_fim (ver types/index.ts)
  // são campos opcionais — o intervalo de descanso não existe até o dono ativá-lo.
  value: string | undefined // "HH:MM" ou ""/undefined
  onChange: (valor: string) => void
  disabled?: boolean
  className?: string
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

// Substitui <input type="time"> nativo: o widget nativo de horário varia
// muito entre navegadores/SOs no mobile — em alguns aparelhos o botão de
// confirmar do seletor nativo sai da tela, e o campo espreme de um jeito
// estranho em layouts de duas colunas (ver relato do dono do projeto). Dois
// selects (hora/minuto) em vez de digitar texto: mesmo comportamento em
// qualquer dispositivo, sem depender de picker nenhum do sistema, e mais
// rápido de escolher que digitar.
export function HoraInput({ id, value, onChange, disabled, className }: HoraInputProps) {
  const [hora, minuto] = (value ?? "").split(":")

  function atualizar(novaHora: string | null, novoMinuto: string | null) {
    if (novaHora && novoMinuto) onChange(`${novaHora}:${novoMinuto}`)
  }

  return (
    <div id={id} className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <Select
        value={hora ?? ""}
        onValueChange={(v) => atualizar(v, minuto || "00")}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="HH">{(v: string | null) => v || "HH"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {HORAS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select
        value={minuto ?? ""}
        onValueChange={(v) => atualizar(hora || "00", v)}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="MM">{(v: string | null) => v || "MM"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MINUTOS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
