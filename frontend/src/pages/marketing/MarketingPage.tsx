import { Link } from "react-router-dom"
import {
  Calendar,
  Check,
  Clock,
  CreditCard,
  LineChart,
  Mail,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/common/ThemeToggle"

const RECURSOS = [
  {
    icone: Calendar,
    titulo: "Agenda completa",
    descricao: "Visão mensal, semanal e diária, com reagendamento e bloqueio de horários.",
  },
  {
    icone: Users,
    titulo: "Sem login pro cliente",
    descricao: "O cliente final agenda direto pela sua página, sem baixar app nem criar conta.",
  },
  {
    icone: Mail,
    titulo: "Notificações por e-mail",
    descricao: "Confirmação na hora e lembrete automático antes do horário marcado.",
  },
  {
    icone: LineChart,
    titulo: "Dashboard financeiro",
    descricao: "Faturamento, recebido x a receber, e sugestões automáticas pra ocupar a agenda.",
  },
  {
    icone: Clock,
    titulo: "Equipe própria",
    descricao: "Convide auxiliares com login e agenda próprios, sem limite de quantidade.",
  },
  {
    icone: CreditCard,
    titulo: "Um preço só",
    descricao: "Sem trava por funcionalidade, sem comissão sobre o que você fatura.",
  },
]

export function MarketingPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AgendHora" className="size-8 rounded-lg" />
          <span className="font-heading text-lg font-semibold">AgendHora</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/login">Entrar</Link>} />
          <Button size="sm" nativeButton={false} render={<Link to="/cadastro">Cadastrar</Link>} />
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
          <h1 className="font-heading text-4xl font-semibold text-balance sm:text-5xl">
            Agendou. Pronto.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            Sistema de agendamento completo pro seu salão, barbearia ou estúdio — sua própria
            página pra clientes marcarem horário sozinhos, agenda organizada e financeiro num só
            lugar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link to="/cadastro">Cadastrar meu estabelecimento</Link>} />
            <Button size="lg" variant="outline" nativeButton={false} render={<Link to="/login">Já tenho conta</Link>} />
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, descricao }) => (
            <div key={titulo} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icone className="size-5" />
              </div>
              <h3 className="font-heading font-medium">{titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
            <p className="text-sm font-medium text-muted-foreground">Plano único, tudo incluso</p>
            <p className="mt-2 font-heading text-5xl font-semibold">
              R$ 19,90<span className="text-lg font-normal text-muted-foreground">/mês</span>
            </p>
            <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2 text-left text-sm text-muted-foreground">
              {[
                "Agendamentos e clientes ilimitados",
                "Quantos auxiliares você precisar, sem custo extra",
                "Sem comissão sobre o que você fatura",
                "Sem contrato de fidelidade",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-8" nativeButton={false} render={<Link to="/cadastro">Começar agora</Link>} />
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
        AgendHora — agendamento simples pra estabelecimentos de serviço.
      </footer>
    </div>
  )
}
