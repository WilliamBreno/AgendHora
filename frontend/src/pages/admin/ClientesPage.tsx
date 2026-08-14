import { useRef, useState } from "react"
import { toast } from "sonner"
import { Cake, Pencil, UserRoundX, Upload, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog"
import { ClienteHistoricoSheet } from "@/components/clientes/ClienteHistoricoSheet"
import { useClientes, type FiltroClientes } from "@/hooks/useClientes"
import { ApiError } from "@/lib/api"
import type { Cliente } from "@/types"

const FILTRO_LABEL: Record<FiltroClientes, string> = {
  todos: "Todos os clientes",
  mes: "Aniversariantes do mês",
  semana: "Aniversariantes da semana",
  sumidos: "Clientes sumidos",
}

const EMPTY_LABEL: Record<FiltroClientes, string> = {
  todos: "Nenhum cliente ainda.",
  mes: "Ninguém faz aniversário nesse período.",
  semana: "Ninguém faz aniversário nesse período.",
  sumidos: "Ninguém sumido — todo mundo agendou nos últimos 60 dias.",
}

function formatarDataNascimento(iso: string) {
  const [ano, mes, dia] = iso.split("-")
  return `${dia}/${mes}/${ano}`
}

export function ClientesPage() {
  const [filtro, setFiltro] = useState<FiltroClientes>("todos")
  const { clientes, loading, criar, atualizar, importar } = useClientes(filtro)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)
  const [clienteHistorico, setClienteHistorico] = useState<Cliente | null>(null)
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
          <Select value={filtro} onValueChange={(v) => setFiltro((v ?? "todos") as FiltroClientes)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os clientes">
                {(v: string | null) => FILTRO_LABEL[(v as FiltroClientes) ?? "todos"]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTRO_LABEL) as FiltroClientes[]).map((f) => (
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
        <p className="text-sm text-muted-foreground">{EMPTY_LABEL[filtro]}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <div
              key={cliente.id}
              role="button"
              tabIndex={0}
              onClick={() => setClienteHistorico(cliente)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setClienteHistorico(cliente)
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{cliente.nome}</p>
                  {cliente.sumido && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <UserRoundX className="size-3" />
                      Sumido
                    </span>
                  )}
                </div>
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
                onClick={(e) => {
                  e.stopPropagation()
                  abrirEdicao(cliente)
                }}
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

      <ClienteHistoricoSheet
        cliente={clienteHistorico}
        onOpenChange={(open) => !open && setClienteHistorico(null)}
      />
    </div>
  )
}
