import { useState } from "react"
import { FileUp, Package, Plus, ShoppingCart } from "lucide-react"
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
import { ProdutoCard } from "@/components/produtos/ProdutoCard"
import { ProdutoFormDialog } from "@/components/produtos/ProdutoFormDialog"
import { VendaProdutoDialog } from "@/components/produtos/VendaProdutoDialog"
import { ImportarProdutosDialog } from "@/components/produtos/ImportarProdutosDialog"
import { useProdutos } from "@/hooks/useProdutos"
import { useVendasProdutos } from "@/hooks/useVendasProdutos"
import { useEquipe } from "@/hooks/useEquipe"
import { useEstabelecimento } from "@/hooks/useEstabelecimento"
import { useAuth } from "@/contexts/AuthContext"
import { ApiError } from "@/lib/api"
import { normalizarTexto } from "@/lib/utils"
import type { Produto, ProdutoInput, VendaProdutoInput } from "@/types"

export function ProdutosPage() {
  const { ehDono, usuario } = useAuth()
  const { produtos, loading, criar, atualizar, excluir, importarPreview, importarConfirmar } =
    useProdutos()
  const { registrar } = useVendasProdutos()
  const { equipe } = useEquipe(ehDono)
  const { estabelecimento } = useEstabelecimento()
  const profissionais = equipe?.profissionais ?? []

  const [formAberto, setFormAberto] = useState(false)
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null)
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [vendaAberta, setVendaAberta] = useState(false)
  const [produtoParaVender, setProdutoParaVender] = useState<Produto | null>(null)
  const [importarAberto, setImportarAberto] = useState(false)
  const [busca, setBusca] = useState("")

  const produtosComEstoqueBaixo = produtos.filter(
    (p) => p.ativo && p.estoque_minimo > 0 && p.quantidade_estoque <= p.estoque_minimo
  )

  const produtosFiltrados = busca.trim()
    ? produtos.filter((p) => normalizarTexto(p.nome).includes(normalizarTexto(busca)))
    : produtos

  function abrirNovo() {
    setProdutoEmEdicao(null)
    setFormAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setProdutoEmEdicao(produto)
    setFormAberto(true)
  }

  function abrirVenda(produto?: Produto) {
    setProdutoParaVender(produto ?? null)
    setVendaAberta(true)
  }

  async function salvar(input: ProdutoInput) {
    try {
      if (produtoEmEdicao) {
        await atualizar(produtoEmEdicao.id, input)
        toast.success("Produto atualizado.")
      } else {
        await criar(input)
        toast.success("Produto criado.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar produto")
      throw err
    }
  }

  async function alternarAtivo(produto: Produto) {
    try {
      await atualizar(produto.id, {
        nome: produto.nome,
        preco: produto.preco,
        custo_unitario: produto.custo_unitario,
        quantidade_estoque: produto.quantidade_estoque,
        estoque_minimo: produto.estoque_minimo,
        ativo: !produto.ativo,
        descricao: produto.descricao,
        foto: produto.foto,
      })
      toast.success(produto.ativo ? "Produto desativado." : "Produto ativado.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar produto")
    }
  }

  async function confirmarExclusao() {
    if (!produtoParaExcluir) return
    setExcluindo(true)
    try {
      await excluir(produtoParaExcluir.id)
      toast.success("Produto excluído.")
      setProdutoParaExcluir(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir produto")
    } finally {
      setExcluindo(false)
    }
  }

  async function registrarVenda(input: VendaProdutoInput) {
    await registrar(input)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo, estoque e vendas pra clientes e para a equipe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportarAberto(true)}>
            <FileUp className="size-4" />
            Importar
          </Button>
          <Button variant="outline" onClick={() => abrirVenda()} disabled={produtos.length === 0}>
            <ShoppingCart className="size-4" />
            Registrar venda
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo produto
          </Button>
        </div>
      </div>

      {produtosComEstoqueBaixo.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Estoque baixo: {produtosComEstoqueBaixo.map((p) => p.nome).join(", ")}.
        </div>
      )}

      {produtos.length > 0 && (
        <BuscaInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar produto pelo nome..."
          className="sm:max-w-xs"
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum produto cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Cadastre produtos pra vender aos clientes ou controlar o uso interno da equipe.
            </p>
          </div>
          <Button onClick={abrirNovo} variant="outline">
            <Plus className="size-4" />
            Novo produto
          </Button>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado para "{busca}".
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {produtosFiltrados.map((produto) => (
            <ProdutoCard
              key={produto.id}
              produto={produto}
              onEdit={() => abrirEdicao(produto)}
              onVender={() => abrirVenda(produto)}
              onDelete={() => setProdutoParaExcluir(produto)}
              onToggleAtivo={() => alternarAtivo(produto)}
            />
          ))}
        </div>
      )}

      <ProdutoFormDialog
        open={formAberto}
        onOpenChange={setFormAberto}
        produto={produtoEmEdicao}
        onSubmit={salvar}
      />

      <VendaProdutoDialog
        open={vendaAberta}
        onOpenChange={setVendaAberta}
        produtos={produtos}
        profissionais={profissionais}
        usuarioAtualId={usuario?.id ?? 0}
        descontoPadrao={estabelecimento?.desconto_profissional_percentual ?? null}
        produtoInicialId={produtoParaVender?.id}
        onSubmit={registrarVenda}
      />

      <ImportarProdutosDialog
        open={importarAberto}
        onOpenChange={setImportarAberto}
        onLerArquivo={importarPreview}
        onConfirmar={importarConfirmar}
      />

      <AlertDialog
        open={produtoParaExcluir !== null}
        onOpenChange={(open) => !open && setProdutoParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{produtoParaExcluir?.nome}"? Se ele já tiver vendas
              registradas, desative em vez de excluir.
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
