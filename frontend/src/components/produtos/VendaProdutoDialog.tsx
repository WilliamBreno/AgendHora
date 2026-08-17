import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TelefoneInput } from "@/components/common/TelefoneInput"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatarPreco } from "@/lib/formatacao"
import { ApiError } from "@/lib/api"
import type { Produto, TipoCompradorVenda, Usuario, VendaProdutoInput } from "@/types"

interface AgendamentoContexto {
  id: number
  clienteNome: string
}

interface VendaProdutoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produtos: Produto[]
  // profissionais vem vazio pra um auxiliar (a lista completa da equipe é
  // rota dono-only) — nesse caso a compra interna vai automaticamente pro
  // próprio usuário logado, sem seletor, mesmo padrão do NovoAgendamentoDialog.
  profissionais: Usuario[]
  usuarioAtualId: number
  descontoPadrao: number | null
  produtoInicialId?: number
  // presente quando aberto de dentro do painel de um agendamento — a venda
  // já nasce vinculada e usa o cliente do próprio agendamento (ver CLAUDE.md
  // "Cadastro de produtos": "clientes finais podem comprar produtos em
  // junção com o serviço").
  agendamento?: AgendamentoContexto
  onSubmit: (input: VendaProdutoInput) => Promise<void>
}

function formVazio(produtoInicialId?: number, agendamento?: AgendamentoContexto): VendaProdutoInput {
  return {
    produto_id: produtoInicialId ?? 0,
    quantidade: 1,
    tipo_comprador: "cliente",
    agendamento_id: agendamento?.id ?? null,
    cliente_nome: "",
    cliente_telefone: "",
    profissional_id: null,
    percentual_desconto: null,
    observacoes: "",
  }
}

export function VendaProdutoDialog({
  open,
  onOpenChange,
  produtos,
  profissionais,
  usuarioAtualId,
  descontoPadrao,
  produtoInicialId,
  agendamento,
  onSubmit,
}: VendaProdutoDialogProps) {
  const [form, setForm] = useState<VendaProdutoInput>(formVazio())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const produtosAtivos = produtos.filter((p) => p.ativo)
  const produtoSelecionado = produtosAtivos.find((p) => p.id === form.produto_id) ?? null
  // só mostra o seletor quando há de fato uma escolha (dono com equipe);
  // com um profissional só (ou auxiliar sem acesso à lista da equipe), a
  // compra vai automaticamente pra ele mesmo.
  const exigeEscolhaProfissional = profissionais.length > 1
  const profissionalUnico = profissionais.length === 1 ? profissionais[0].id : usuarioAtualId

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(formVazio(produtoInicialId, agendamento))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, produtoInicialId, agendamento?.id])

  function atualizarCampo<K extends keyof VendaProdutoInput>(campo: K, valor: VendaProdutoInput[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function escolherTipo(tipo: TipoCompradorVenda) {
    setForm((f) => ({
      ...f,
      tipo_comprador: tipo,
      profissional_id: tipo === "profissional" ? (exigeEscolhaProfissional ? null : profissionalUnico) : null,
      percentual_desconto: tipo === "profissional" ? descontoPadrao : null,
    }))
  }

  const precoUnitario = produtoSelecionado?.preco ?? 0
  const percentual = form.tipo_comprador === "profissional" ? (form.percentual_desconto ?? 0) : 0
  const subtotal = precoUnitario * form.quantidade
  const desconto = subtotal * (percentual / 100)
  const total = Math.max(0, subtotal - desconto)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (!form.produto_id) {
      setErro("Selecione um produto.")
      return
    }
    if (form.quantidade <= 0) {
      setErro("A quantidade precisa ser maior que zero.")
      return
    }
    if (produtoSelecionado && form.quantidade > produtoSelecionado.quantidade_estoque) {
      setErro(`Estoque insuficiente — disponível: ${produtoSelecionado.quantidade_estoque}.`)
      return
    }
    if (form.tipo_comprador === "cliente" && !agendamento) {
      if (!form.cliente_nome?.trim() || !form.cliente_telefone?.trim()) {
        setErro("Informe o nome e o telefone do cliente.")
        return
      }
    }
    if (form.tipo_comprador === "profissional" && !form.profissional_id) {
      setErro("Selecione o profissional.")
      return
    }

    setSalvando(true)
    try {
      await onSubmit(form)
      toast.success("Venda registrada.")
      onOpenChange(false)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível registrar a venda.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar venda de produto</DialogTitle>
            <DialogDescription>
              {agendamento
                ? `Vincula a venda ao agendamento de ${agendamento.clienteNome}.`
                : "Venda avulsa pro cliente final ou compra interna da equipe."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="grid gap-1.5">
              <Label>Produto</Label>
              <Select
                value={form.produto_id ? String(form.produto_id) : ""}
                onValueChange={(value) => atualizarCampo("produto_id", Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um produto">
                    {(value: string | null) => {
                      const produto = produtosAtivos.find((p) => String(p.id) === value)
                      return produto ? `${produto.nome} · ${formatarPreco(produto.preco)}` : null
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {produtosAtivos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome} · {formatarPreco(p.preco)} · {p.quantidade_estoque} em estoque
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                min={1}
                step="1"
                value={form.quantidade}
                onChange={(e) => atualizarCampo("quantidade", Number(e.target.value))}
              />
            </div>

            {!agendamento && (
              <div className="grid gap-1.5">
                <Label>Quem está comprando?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => escolherTipo("cliente")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      form.tipo_comprador === "cliente"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Cliente final
                  </button>
                  <button
                    type="button"
                    onClick={() => escolherTipo("profissional")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      form.tipo_comprador === "profissional"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Profissional (uso interno)
                  </button>
                </div>
              </div>
            )}

            {form.tipo_comprador === "cliente" && !agendamento && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="cliente_nome">Nome do cliente</Label>
                  <Input
                    id="cliente_nome"
                    value={form.cliente_nome ?? ""}
                    onChange={(e) => atualizarCampo("cliente_nome", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cliente_telefone">Telefone</Label>
                  <TelefoneInput
                    id="cliente_telefone"
                    value={form.cliente_telefone ?? ""}
                    onChange={(valor) => atualizarCampo("cliente_telefone", valor)}
                  />
                </div>
              </div>
            )}

            {form.tipo_comprador === "profissional" && (
              <>
                {exigeEscolhaProfissional && (
                  <div className="grid gap-1.5">
                    <Label>Profissional</Label>
                    <Select
                      value={form.profissional_id ? String(form.profissional_id) : ""}
                      onValueChange={(value) => atualizarCampo("profissional_id", Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o profissional">
                          {(value: string | null) => {
                            const profissional = profissionais.find((p) => String(p.id) === value)
                            return profissional ? profissional.nome : null
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {profissionais.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="desconto">Desconto (%)</Label>
                  <Input
                    id="desconto"
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    value={form.percentual_desconto ?? ""}
                    placeholder="Sem desconto"
                    onChange={(e) =>
                      atualizarCampo(
                        "percentual_desconto",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                  {descontoPadrao !== null && (
                    <p className="text-xs text-muted-foreground">
                      Desconto padrão da equipe: {descontoPadrao}%. Pode ser alterado só nessa venda.
                    </p>
                  )}
                </div>
              </>
            )}

            {produtoSelecionado && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatarPreco(subtotal)}</span>
                </div>
                {desconto > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Desconto ({percentual}%)</span>
                    <span>-{formatarPreco(desconto)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-border pt-1 font-heading font-semibold">
                  <span>Total</span>
                  <span>{formatarPreco(total)}</span>
                </div>
              </div>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Registrando..." : "Registrar venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
