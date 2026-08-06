import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/contexts/ThemeContext"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { tema, alternarTema } = useTheme()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={alternarTema}
      className={cn("shrink-0", className)}
    >
      {tema === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">
        {tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      </span>
    </Button>
  )
}
