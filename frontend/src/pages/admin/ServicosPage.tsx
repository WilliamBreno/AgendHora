import { useState } from "react"
import { Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BuscaInput } from "@/components/common/BuscaInput"
import { ServicoCard } from "@/components/servicos/ServicoCard"
import { ServicoFormDialog } from "@/components/servicos/ServicoFormDialog"
import { useServicos } from "@/hooks/useServicos"
import { useEstabelecimento } from "@/hooks/useEstabelecimento"
import { useEquipe } from "@/hooks/useEquipe"
import { useAuth } from "@/contexts/AuthContext"
import { ApiError } from "@/lib/api"
import { normalizarTexto } from "@/lib/utils"
import type { Servico, ServicoInput } from "@/types"

export function ServicosPage() {
  const { ehDono, usuario } = useAuth()
  const { servicos, loading, criar, atualizar, excluir } = useServicos()
  const { estabelecimento } = useEstabelecimento()
  const { equipe } = useEquipe(ehDono)
  const profissionais = equipe?.profissionais ?? []

  const [formAberto, setFormAberto] = useState(false)
  const [servicoEmEdicao, setServicoEmEdicao] = useState<Servico | null>(null)
  const [servicoParaExcluir, setServicoParaExcluir] = useState<Servico | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [busca, setBusca] = useState("")

  const servicosFiltrados = busca.trim()
    ? servicos.filter((s) => normalizarTexto(s.nome).includes(normalizarTexto(busca)))
    : servicos

  function abrirNovo() {
    setServicoEmEdicao(null)
    setFormAberto(true)
  }

  function abrirEdicao(servico: Servico) {
    setServicoEmEdicao(servico)
    setFormAberto(true)
  }

  async function salvar(input: ServicoInput) {
    try {
      if (servicoEmEdicao) {
        await atualizar(servicoEmEdicao.id, input)
        toast.success("Serviço atualizado.")
      } else {
        await criar(input)
        toast.success("Serviço criado.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar serviço")
      throw err
    }
  }

  async function confirmarExclusao() {
    if (!servicoParaExcluir) return
    setExcluindo(true)
    try {
      await excluir(servicoParaExcluir.id)
      toast.success("Serviço excluído.")
      setServicoParaExcluir(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir serviço")
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Os serviços oferecidos pelo estabelecimento.
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </div>

      {servicos.length > 0 && (
        <BuscaInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar serviço pelo nome..."
          className="sm:max-w-xs"
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : servicos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Sparkles className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum serviço cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Crie o primeiro serviço para começar a receber agendamentos.
            </p>
          </div>
          <Button onClick={abrirNovo} variant="outline">
            <Plus className="size-4" />
            Novo serviço
          </Button>
        </div>
      ) : servicosFiltrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum serviço encontrado para "{busca}".
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {servicosFiltrados.map((servico) => (
            <ServicoCard
              key={servico.id}
              servico={servico}
              onEdit={() => abrirEdicao(servico)}
              onDelete={() => setServicoParaExcluir(servico)}
            />
          ))}
        </div>
      )}

      <ServicoFormDialog
        open={formAberto}
        onOpenChange={setFormAberto}
        servico={servicoEmEdicao}
        iconesDisponiveis={estabelecimento?.icones_padrao ?? []}
        ehDono={ehDono}
        usuarioAtual={usuario}
        profissionais={profissionais}
        onSubmit={salvar}
      />

      <AlertDialog
        open={servicoParaExcluir !== null}
        onOpenChange={(open) => !open && setServicoParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{servicoParaExcluir?.nome}"? Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
