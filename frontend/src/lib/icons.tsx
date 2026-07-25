import { icons, HelpCircle, type LucideProps } from "lucide-react"

interface DynamicIconProps extends LucideProps {
  name: string
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = icons[name as keyof typeof icons] ?? HelpCircle
  return <IconComponent {...props} />
}
