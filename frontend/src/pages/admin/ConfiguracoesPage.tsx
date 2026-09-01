import { Copy } from "lucide-react"
import { toast } from "sonner"
import { useEstabelecimento } from "@/hooks/useEstabelecimento"
import { IconesPadraoManager } from "@/components/configuracoes/IconesPadraoManager"
import { DadosEstabelecimentoForm } from "@/components/configuracoes/DadosEstabelecimentoForm"
import { HorarioFuncionamentoEditor } from "@/components/configuracoes/HorarioFuncionamentoEditor"
import { LogoUploadField } from "@/components/configuracoes/LogoUploadField"
import { WhatsAppIntegracaoCard } from "@/components/configuracoes/WhatsAppIntegracaoCard"
import { AvisoEditor } from "@/components/configuracoes/AvisoEditor"
import { DescontoProfissionalEditor } from "@/components/configuracoes/DescontoProfissionalEditor"
import { DiasReagendamentoEditor } from "@/components/configuracoes/DiasReagendamentoEditor"
import { MeuPlanoCard } from "@/components/configuracoes/MeuPlanoCard"
import { Button } from "@/components/ui/button"

export function ConfiguracoesPage() {
  const {
    estabelecimento,
    loading,
    atualizarIcones,
    atualizarDados,
    atualizarHorario,
    atualizarLogo,
    atualizarAviso,
    renovar,
    verificarRenovacao,
    atualizarDescontoProfissional,
    atualizarDiasReagendamento,
  } = useEstabelecimento()

  const linkPublico = estabelecimento ? `${window.location.origin}/${estabelecimento.slug}` : ""

  function copiarLink() {
    navigator.clipboard.writeText(linkPublico)
    toast.success("Link copiado.")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências gerais do estabelecimento.</p>
      </div>

      {estabelecimento && (
        <MeuPlanoCard
          estabelecimento={estabelecimento}
          onRenovar={renovar}
          onVerificar={verificarRenovacao}
        />
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Página pública</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O link que você compartilha com os clientes pra eles agendarem.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                  {linkPublico}
                </code>
                <Button type="button" variant="outline" size="icon-sm" onClick={copiarLink}>
                  <Copy className="size-4" />
                </Button>
              </div>
              <LogoUploadField logo={estabelecimento.logo} onAtualizar={atualizarLogo} />
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Dados do estabelecimento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O e-mail é usado para receber o aviso de cada novo agendamento.
        </p>
        <div className="mt-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <DadosEstabelecimentoForm
              estabelecimento={estabelecimento}
              onAtualizar={atualizarDados}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Horário de funcionamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define os horários que aparecem como disponíveis pros clientes na página pública.
        </p>
        <div className="mt-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <HorarioFuncionamentoEditor
              horarios={estabelecimento.horario_funcionamento}
              onAtualizar={atualizarHorario}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Aviso / anúncio</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma faixa chamativa e opcional na página de agendamento — pra promoções ou avisos, sem
          atrapalhar o cliente a agendar.
        </p>
        <div className="mt-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <AvisoEditor
              ativo={estabelecimento.aviso_ativo}
              texto={estabelecimento.aviso_texto}
              corTexto={estabelecimento.aviso_cor_texto}
              corFundo={estabelecimento.aviso_cor_fundo}
              onAtualizar={atualizarAviso}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Desconto da equipe em produtos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando um profissional compra um produto internamente, esse desconto entra
          automaticamente — pode ser ajustado em cada venda.
        </p>
        <div className="mt-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <DescontoProfissionalEditor
              percentual={estabelecimento.desconto_profissional_percentual}
              onAtualizar={atualizarDescontoProfissional}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Reagendamento automático</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Avisa por e-mail quem sumiu, sugerindo um novo horário.
        </p>
        <div className="mt-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <DiasReagendamentoEditor
              dias={estabelecimento.dias_reagendamento}
              onAtualizar={atualizarDiasReagendamento}
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="font-heading font-medium">Integrações</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Outros canais pra automatizar o contato com seus clientes.
        </p>
        <WhatsAppIntegracaoCard />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Ícones padrão</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina quais ícones ficam disponíveis no seletor ao cadastrar um serviço.
        </p>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <IconesPadraoManager
              icones={estabelecimento?.icones_padrao ?? []}
              onAtualizar={atualizarIcones}
            />
          )}
        </div>
      </section>
    </div>
  )
}
