import { useState } from "react"
import { Input } from "@/components/ui/input"
import { normalizarTexto, cn } from "@/lib/utils"
import type { Cliente } from "@/types"

interface ClienteAutocompleteProps {
  id?: string
  value: string
  onChangeNome: (nome: string) => void
  // disparado quando o usuário clica numa sugestão — quem chama decide o que
  // fazer com o telefone (normalmente preencher o campo ao lado).
  onSelecionar: (cliente: Cliente) => void
  clientes: Cliente[]
  placeholder?: string
  className?: string
}

const MAX_SUGESTOES = 6

// ClienteAutocomplete busca (sem acento, sem diferenciar maiúsculas) entre os
// clientes já cadastrados enquanto o usuário digita o nome — ao clicar numa
// sugestão, quem chama preenche nome + telefone de uma vez, sem precisar
// digitar o contato de um cliente que já tem cadastro. Usado no registro de
// venda de produto e na criação manual de agendamento pelo admin.
export function ClienteAutocomplete({
  id,
  value,
  onChangeNome,
  onSelecionar,
  clientes,
  placeholder,
  className,
}: ClienteAutocompleteProps) {
  const [aberto, setAberto] = useState(false)

  const termo = normalizarTexto(value.trim())
  const sugestoes = termo
    ? clientes.filter((c) => normalizarTexto(c.nome).includes(termo)).slice(0, MAX_SUGESTOES)
    : []

  function selecionar(cliente: Cliente) {
    onSelecionar(cliente)
    setAberto(false)
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChangeNome(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {sugestoes.map((cliente) => (
            <button
              key={cliente.id}
              type="button"
              // evita que o blur do input feche a lista antes do clique
              // registrar — sem isso o dropdown some e o clique não conta.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionar(cliente)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium">{cliente.nome}</span>
              <span className="text-xs text-muted-foreground">{cliente.telefone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
