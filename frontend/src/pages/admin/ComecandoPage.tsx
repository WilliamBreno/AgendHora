import { useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, Clock, Copy, ImagePlus, PartyPopper, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"

interface Passo {
  chave: "servicos" | "horario" | "logo"
  icone: typeof Sparkles
  titulo: string
  descricao: string
  linkTexto: string
  linkPara: string
}

const PASSOS: Passo[] = [
  {
    chave: "servicos",
    icone: Sparkles,
    titulo: "Cadastre seus serviços",
    descricao:
      "Nome, preço, duração, cor e ícone de cada serviço que você oferece. É o que aparece pro cliente escolher na hora de agendar.",
    linkTexto: "Ir para Serviços",
    linkPara: "/admin/servicos",
  },
  {
    chave: "horario",
    icone: Clock,
    titulo: "Configure seu horário de funcionamento",
    descricao:
      "Defina os dias e horários em que você atende. É a partir disso que o sistema calcula os horários livres pro cliente escolher.",
    linkTexto: "Ir para Configurações",
    linkPara: "/admin/configuracoes",
  },
  {
    chave: "logo",
    icone: ImagePlus,
    titulo: "Adicione sua logo (opcional)",
    descricao: "Deixa sua página de agendamento com a cara do seu negócio.",
    linkTexto: "Ir para Configurações",
    linkPara: "/admin/configuracoes",
  },
]

export function ComecandoPage() {
  const { estabelecimento } = useAuth()
  const { carregando, temServicos, temHorario, temLogo, obrigatoriosCompletos } =
    useOnboardingStatus()
  const [copiado, setCopiado] = useState(false)

  const concluido: Record<Passo["chave"], boolean> = {
    servicos: temServicos,
    horario: temHorario,
    logo: temLogo,
  }

  const passosPendentes = PASSOS.filter((passo) => !concluido[passo.chave])

  const linkPublico = estabelecimento ? `${window.location.origin}/${estabelecimento.slug}` : ""

  function copiarLink() {
    navigator.clipboard.writeText(linkPublico)
    setCopiado(true)
    toast.success("Link copiado.")
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Bem-vindo, {estabelecimento?.nome}!
        </h1>
        <p className="text-sm text-muted-foreground">
          {carregando
            ? "Carregando..."
            : obrigatoriosCompletos
              ? "Sua agenda já está pronta pra receber clientes."
              : "Faltam só alguns passos pra sua agenda começar a receber clientes."}
        </p>
      </div>

      {!carregando && (
        <div className="flex flex-col gap-4">
          {obrigatoriosCompletos && (
            <div className="flex items-center gap-3 rounded-xl border border-servico-teal/30 bg-servico-teal/5 p-5">
              <PartyPopper className="size-6 shrink-0 text-servico-teal" />
              <p className="text-sm">
                Tudo certo! Serviços e horário configurados — sua página já está funcionando.
                {!temLogo && " Se quiser, ainda dá pra adicionar uma logo abaixo."}
              </p>
            </div>
          )}

          {passosPendentes.map((passo) => (
            <div
              key={passo.chave}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <passo.icone className="size-4" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading font-medium">{passo.titulo}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{passo.descricao}</p>
                <Button
                  render={<Link to={passo.linkPara} />}
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  {passo.linkTexto}
                </Button>
              </div>
            </div>
          ))}

          {PASSOS.filter((passo) => concluido[passo.chave]).length > 0 && (
            <div className="flex flex-col gap-2">
              {PASSOS.filter((passo) => concluido[passo.chave]).map((passo) => (
                <div
                  key={passo.chave}
                  className="flex items-center gap-2 px-1 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-servico-teal" />
                  <span className="line-through">{passo.titulo}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex-1">
              <h2 className="font-heading font-medium">Compartilhe seu link de agendamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Esse é o link que seus clientes usam pra agendar — manda no WhatsApp, coloca na
                bio do Instagram, onde fizer sentido.
              </p>
              {linkPublico && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                    {linkPublico}
                  </code>
                  <Button type="button" variant="outline" size="icon-sm" onClick={copiarLink}>
                    <Copy className="size-4" />
                    <span className="sr-only">Copiar link</span>
                  </Button>
                </div>
              )}
              {copiado && <p className="mt-1 text-xs text-primary">Copiado!</p>}
            </div>
          </div>
        </div>
      )}

      <Button
        render={<Link to="/admin/dashboard" />}
        nativeButton={false}
        className="self-start"
      >
        Ir para o painel
      </Button>
    </div>
  )
}
