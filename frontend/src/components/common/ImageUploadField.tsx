import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { ImageOff, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageUploadFieldProps {
  value: string
  onChange: (dataUri: string) => void | Promise<void>
  trocarLabel?: string
  enviarLabel?: string
  ajuda?: string
  className?: string
}

// ~1,5MB de arquivo — o backend aceita até ~2MB já em base64 (que infla ~33%).
const TAMANHO_MAXIMO_ARQUIVO = 1.5 * 1024 * 1024

// Campo genérico de upload de imagem (vira data URI base64, sem depender de
// nenhum serviço de storage externo). Usado tanto pra logo do estabelecimento
// quanto pra foto de exemplo do serviço — o chamador decide o que acontece
// com o valor (salvar na hora, ou só guardar no estado de um formulário).
export function ImageUploadField({
  value,
  onChange,
  trocarLabel = "Trocar imagem",
  enviarLabel = "Enviar imagem",
  ajuda = "PNG ou JPG, até 1,5MB.",
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)

  function abrirSeletor() {
    inputRef.current?.click()
  }

  async function handleArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ""
    if (!arquivo) return

    if (!arquivo.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.")
      return
    }
    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
      toast.error("Imagem muito grande (máximo ~1,5MB).")
      return
    }

    const dataUri = await new Promise<string>((resolve, reject) => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(leitor.result as string)
      leitor.onerror = () => reject(leitor.error)
      leitor.readAsDataURL(arquivo)
    })

    setEnviando(true)
    try {
      await onChange(dataUri)
    } catch {
      toast.error("Erro ao enviar imagem")
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    setEnviando(true)
    try {
      await onChange("")
    } catch {
      toast.error("Erro ao remover imagem")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={abrirSeletor}
            disabled={enviando}
          >
            <Upload className="size-4" />
            {value ? trocarLabel : enviarLabel}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={enviando}>
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{ajuda}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleArquivo}
      />
    </div>
  )
}
