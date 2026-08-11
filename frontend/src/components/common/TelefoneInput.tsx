import { Input } from "@/components/ui/input"

interface TelefoneInputProps {
  id?: string
  value: string
  onChange: (valor: string) => void
  className?: string
}

// Formata progressivamente enquanto digita: (11) 9999-9999 pra fixo (10
// dígitos), (11) 99999-9999 pra celular (11 dígitos) — o formato muda
// sozinho assim que o nono dígito do número aparece.
function formatarTelefone(digitos: string): string {
  if (digitos.length === 0) return ""
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

export function TelefoneInput({ id, value, onChange, className }: TelefoneInputProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitos = event.target.value.replace(/\D/g, "").slice(0, 11)
    onChange(formatarTelefone(digitos))
  }

  return (
    <Input
      id={id}
      type="tel"
      inputMode="numeric"
      placeholder="(11) 98888-7777"
      maxLength={16}
      value={value}
      onChange={handleChange}
      className={className}
    />
  )
}
