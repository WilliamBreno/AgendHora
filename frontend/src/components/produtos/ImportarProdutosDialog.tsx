import { useRef, useState } from "react"
import { toast } from "sonner"
import { FileUp, Trash2, Upload } from "lucide-react"
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
import { ApiError } from "@/lib/api"
import type { ImportacaoProdutosResultado, ItemImportadoProduto } from "@/types"

interface ImportarProdutosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLerArquivo: (arquivo: File) => Promise<ItemImportadoProduto[]>
  onConfirmar: (itens: ItemImportadoProduto[]) => Promise<ImportacaoProdutosResultado>
}

type Passo = "arquivo" | "revisao"

// Importação de produtos a partir de PDF ou XLSX (ver CLAUDE.md "Importação
// de produtos") — sempre passa por essa prévia editável antes de salvar
// qualquer coisa, porque a leitura de PDF é heurística (baseada em padrão
// de texto) e pode errar em alguns layouts.
export function ImportarProdutosDialog({
  open,
  onOpenChange,
  onLerArquivo,
  onConfirmar,
}: ImportarProdutosDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [passo, setPasso] = useState<Passo>("arquivo")
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [itens, setItens] = useState<ItemImportadoProduto[]>([])
  const [lendo, setLendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function resetar() {
    setPasso("arquivo")
    setNomeArquivo("")
    setItens([])
    setErro(null)
  }

  async function handleArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ""
    if (!arquivo) return

    setErro(null)
    setNomeArquivo(arquivo.name)
    setLendo(true)
    try {
      const encontrados = await onLerArquivo(arquivo)
      setItens(encontrados)
      setPasso("revisao")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível ler o arquivo.")
      setNomeArquivo("")
    } finally {
      setLendo(false)
    }
  }

  function atualizarItem(index: number, campo: keyof ItemImportadoProduto, valor: string) {
    setItens((atual) =>
      atual.map((item, i) =>
        i === index
          ? { ...item, [campo]: campo === "preco" ? Number(valor) : valor }
          : item
      )
    )
  }

  function removerItem(index: number) {
    setItens((atual) => atual.filter((_, i) => i !== index))
  }

  async function confirmar() {
    const validos = itens.filter((item) => item.nome.trim() !== "" && item.preco > 0)
    if (validos.length === 0) {
      setErro("Nenhum item válido pra importar — confira nome e preço.")
      return
    }
    setErro(null)
    setConfirmando(true)
    try {
      const resultado = await onConfirmar(validos)
      toast.success(
        `Importação concluída: ${resultado.criados} criado(s), ${resultado.atualizados} atualizado(s).`
      )
      resetar()
      onOpenChange(false)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível importar os produtos.")
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetar()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar produtos</DialogTitle>
          <DialogDescription>
            {passo === "arquivo"
              ? "Envie uma lista de produtos em PDF ou planilha (XLSX) com nome e preço."
              : "Confira e corrija antes de salvar — nada foi cadastrado ainda."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
          {passo === "arquivo" && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
              <FileUp className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {nomeArquivo || "Nenhum arquivo selecionado"}
                </p>
                <p className="text-sm text-muted-foreground">Formatos aceitos: .pdf, .xlsx</p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={lendo}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                {lendo ? "Lendo arquivo..." : "Escolher arquivo"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xlsx"
                className="hidden"
                onChange={handleArquivo}
              />
            </div>
          )}

          {passo === "revisao" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {itens.length} produto(s) encontrado(s) em "{nomeArquivo}".
              </p>
              {itens.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item.nome}
                    onChange={(e) => atualizarItem(index, "nome", e.target.value)}
                    placeholder="Nome do produto"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.preco || ""}
                    onChange={(e) => atualizarItem(index, "preco", e.target.value)}
                    placeholder="Preço"
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removerItem(index)}
                    aria-label="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum item sobrou pra importar.
                </p>
              )}
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        {passo === "revisao" && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetar}>
              Escolher outro arquivo
            </Button>
            <Button type="button" onClick={confirmar} disabled={confirmando}>
              {confirmando ? "Importando..." : "Confirmar importação"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
