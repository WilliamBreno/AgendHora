import { useEstabelecimento } from "@/hooks/useEstabelecimento"
import { IconesPadraoManager } from "@/components/configuracoes/IconesPadraoManager"

export function ConfiguracoesPage() {
  const { estabelecimento, loading, atualizarIcones } = useEstabelecimento()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Preferências gerais do estabelecimento.
        </p>
      </div>

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
