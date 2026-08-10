import { Input } from "@/components/ui/input"

interface HoraInputProps {
  id?: string
  value: string // "HH:MM" ou ""
  onChange: (valor: string) => void
  disabled?: boolean
  className?: string
}

// Substitui <input type="time"> nativo: o widget nativo de horário varia
// muito entre navegadores/SOs no mobile — em alguns aparelhos o botão de
// confirmar do seletor nativo sai da tela, e o campo espreme de um jeito
// estranho em layouts de duas colunas (ver relato do dono do projeto).
// Aqui é só um campo de texto controlado, com máscara simples (insere ":"
// depois dos dois primeiros dígitos) — mesmo comportamento em qualquer
// dispositivo, sem depender de picker nenhum do sistema. Validação de
// intervalo (hora 00-23, minuto 00-59) já é feita no backend ao salvar.
export function HoraInput({ id, value, onChange, disabled, className }: HoraInputProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitos = event.target.value.replace(/\D/g, "").slice(0, 4)
    const formatado = digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos
    onChange(formatado)
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      maxLength={5}
      value={value}
      disabled={disabled}
      onChange={handleChange}
      className={className}
    />
  )
}
