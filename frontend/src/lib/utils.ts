import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MARCAS_DIACRITICAS = /[̀-ͯ]/g

// Remove acentos e ignora maiúsculas/minúsculas — usado nos filtros de busca
// pra não depender do usuário digitar acento certo.
export function normalizarTexto(texto: string) {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLowerCase()
}
