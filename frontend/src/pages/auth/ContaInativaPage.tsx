import { Link } from "react-router-dom"
import { ThemeToggle } from "@/components/common/ThemeToggle"

export function ContaInativaPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm text-center">
        <img src="/logo.png" alt="AgendHora" className="mx-auto size-12 rounded-xl" />
        <h1 className="mt-4 font-heading text-xl font-semibold">Conta temporariamente indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu acesso está pausado. Entre em contato pra regularizar o pagamento e voltar a usar o
          sistema normalmente.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm text-primary hover:underline"
        >
          Voltar pro login
        </Link>
      </div>
    </div>
  )
}
