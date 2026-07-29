import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { ImageOff, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"

interface LogoUploadFieldProps {
  logo: string
  onAtualizar: (logo: string) => Promise<string>
}

// ~1,5MB de arquivo — o backend aceita até ~2MB já em base64 (que infla ~33%).
const TAMANHO_MAXIMO_ARQUIVO = 1.5 * 1024 * 1024

export function LogoUploadField({ logo, onAtualizar }: LogoUploadFieldProps) {
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
      await onAtualizar(dataUri)
      toast.success("Logo atualizada.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao enviar logo")
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    setEnviando(true)
    try {
      await onAtualizar("")
      toast.success("Logo removida.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover logo")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {logo ? (
          <img src={logo} alt="Logo" className="size-full object-cover" />
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
            {logo ? "Trocar logo" : "Enviar logo"}
          </Button>
          {logo && (
            <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={enviando}>
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG ou JPG, até 1,5MB.</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleArquivo} />
    </div>
  )
}
