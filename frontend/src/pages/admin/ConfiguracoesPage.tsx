import { useEstabelecimento } from "@/hooks/useEstabelecimento"
import { IconesPadraoManager } from "@/components/configuracoes/IconesPadraoManager"
import { DadosEstabelecimentoForm } from "@/components/configuracoes/DadosEstabelecimentoForm"
import { HorarioFuncionamentoEditor } from "@/components/configuracoes/HorarioFuncionamentoEditor"

export function ConfiguracoesPage() {
  const { estabelecimento, loading, atualizarIcones, atualizarDados, atualizarHorario } =
    useEstabelecimento()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências gerais do estabelecimento.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Dados do estabelecimento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O e-mail é usado para receber o aviso de cada novo agendamento.
        </p>
        <div className="mt-4">
          {loading || !estabelecimento ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <DadosEstabelecimentoForm estabelecimento={estabelecimento} onAtualizar={atualizarDados} />
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
