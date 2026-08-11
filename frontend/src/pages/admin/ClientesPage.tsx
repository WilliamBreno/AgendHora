import { useRef, useState } from "react"
import { toast } from "sonner"
import { Cake, Pencil, Upload, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog"
import { useClientes, type FiltroAniversariantes } from "@/hooks/useClientes"
import { ApiError } from "@/lib/api"
import type { Cliente } from "@/types"

const FILTRO_LABEL: Record<FiltroAniversariantes, string> = {
  todos: "Todos os clientes",
  mes: "Aniversariantes do mês",
  semana: "Aniversariantes da semana",
}

function formatarDataNascimento(iso: string) {
  const [ano, mes, dia] = iso.split("-")
  return `${dia}/${mes}/${ano}`
}

export function ClientesPage() {
  const [filtro, setFiltro] = useState<FiltroAniversariantes>("todos")
  const { clientes, loading, criar, atualizar, importar } = useClientes(filtro)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)
  const [importando, setImportando] = useState(false)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  function abrirNovo() {
    setClienteEditando(null)
    setDialogAberto(true)
  }

  function abrirEdicao(cliente: Cliente) {
    setClienteEditando(cliente)
    setDialogAberto(true)
  }

  async function handleImportar(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ""
    if (!arquivo) return

    setImportando(true)
    try {
      const resultado = await importar(arquivo)
      toast.success(
        `Importação concluída: ${resultado.criados} novo(s), ${resultado.atualizados} atualizado(s).`
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao importar arquivo")
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Todo mundo que já agendou, mais quem você cadastrar ou importar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtro} onValueChange={(v) => setFiltro((v ?? "todos") as FiltroAniversariantes)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os clientes">
                {(v: string | null) => FILTRO_LABEL[(v as FiltroAniversariantes) ?? "todos"]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTRO_LABEL) as FiltroAniversariantes[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTRO_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".csv,.vcf"
            className="hidden"
            onChange={handleImportar}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={importando}
            onClick={() => inputArquivoRef.current?.click()}
          >
            <Upload className="size-4" />
            {importando ? "Importando..." : "Importar"}
          </Button>
          <Button size="sm" onClick={abrirNovo}>
            <UserPlus className="size-4" /> Novo cliente
          </Button>
        </div>
      </div>

      <p className="-mt-4 text-xs text-muted-foreground">
        Importação aceita arquivo .csv (colunas Nome, Telefone e Data de Nascimento) ou .vcf
        (exportado do celular).
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filtro === "todos" ? "Nenhum cliente ainda." : "Ninguém faz aniversário nesse período."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <div
              key={cliente.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex-1">
                <p className="font-medium">{cliente.nome}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{cliente.telefone}</span>
                  {cliente.data_nascimento && (
                    <span className="flex items-center gap-1">
                      <Cake className="size-3.5" />
                      {formatarDataNascimento(cliente.data_nascimento)}
                    </span>
                  )}
                  <span>
                    {cliente.agendamentos_count}{" "}
                    {cliente.agendamentos_count === 1 ? "agendamento" : "agendamentos"}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => abrirEdicao(cliente)}
              >
                <Pencil className="size-4" />
                <span className="sr-only">Editar</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <ClienteFormDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        cliente={clienteEditando}
        onSalvar={(input) =>
          clienteEditando ? atualizar(clienteEditando.id, input) : criar(input)
        }
      />
    </div>
  )
}
