// Package brtime centraliza a lógica de "dia civil no fuso do Brasil" usada
// por mais de uma rotina de cron (renovação mensal, resumo semanal) — evita
// duplicar o mesmo carregamento de fuso horário em cada pacote.
package brtime

import (
	"log"
	"time"
)

// Fuso carrega America/Sao_Paulo — usado em qualquer comparação de "hoje"
// que precisa ser sempre no fuso do Brasil, nunca o fuso do servidor (que
// pode ser UTC em produção). Se o container não tiver os dados de fuso
// horário instalados (imagens mínimas às vezes não têm), cai pro fuso do
// servidor e loga o aviso — ainda funciona, só que sujeito ao fuso do host.
func Fuso() *time.Location {
	fuso, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		log.Printf("aviso: não foi possível carregar o fuso America/Sao_Paulo (%v) — usando o fuso do servidor", err)
		return time.Local
	}
	return fuso
}

// InicioDoDia trunca pra 00:00 do dia civil no fuso informado.
func InicioDoDia(t time.Time, fuso *time.Location) time.Time {
	t = t.In(fuso)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, fuso)
}
