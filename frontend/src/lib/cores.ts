import type { CorServico } from "@/types"

// Classes escritas por extenso (não construídas dinamicamente) para o
// scanner do Tailwind conseguir detectá-las no build.
export const CORES_SERVICO_CLASSES: Record<
  CorServico,
  { bg: string; bgSoft: string; border: string; text: string }
> = {
  teal: {
    bg: "bg-servico-teal",
    bgSoft: "bg-servico-teal/10",
    border: "border-servico-teal",
    text: "text-servico-teal",
  },
  coral: {
    bg: "bg-servico-coral",
    bgSoft: "bg-servico-coral/10",
    border: "border-servico-coral",
    text: "text-servico-coral",
  },
  violeta: {
    bg: "bg-servico-violeta",
    bgSoft: "bg-servico-violeta/10",
    border: "border-servico-violeta",
    text: "text-servico-violeta",
  },
  ambar: {
    bg: "bg-servico-ambar",
    bgSoft: "bg-servico-ambar/10",
    border: "border-servico-ambar",
    text: "text-servico-ambar",
  },
  "verde-salvia": {
    bg: "bg-servico-verde-salvia",
    bgSoft: "bg-servico-verde-salvia/10",
    border: "border-servico-verde-salvia",
    text: "text-servico-verde-salvia",
  },
  rosa: {
    bg: "bg-servico-rosa",
    bgSoft: "bg-servico-rosa/10",
    border: "border-servico-rosa",
    text: "text-servico-rosa",
  },
}

export const CORES_SERVICO_LABEL: Record<CorServico, string> = {
  teal: "Teal",
  coral: "Coral",
  violeta: "Violeta",
  ambar: "Âmbar",
  "verde-salvia": "Verde-sálvia",
  rosa: "Rosa",
}
