import { toast } from "sonner"
import { ImageUploadField } from "@/components/common/ImageUploadField"

interface LogoUploadFieldProps {
  logo: string
  onAtualizar: (logo: string) => Promise<string>
}

export function LogoUploadField({ logo, onAtualizar }: LogoUploadFieldProps) {
  async function handleChange(dataUri: string) {
    await onAtualizar(dataUri)
    toast.success(dataUri ? "Logo atualizada." : "Logo removida.")
  }

  return (
    <ImageUploadField
      value={logo}
      onChange={handleChange}
      trocarLabel="Trocar logo"
      enviarLabel="Enviar logo"
    />
  )
}
