// Package renovacao é a rotina diária de cobrança recorrente (ver CLAUDE.md
// "Renovação mensal") — mesma ideia do internal/lembretes (laço próprio, sem
// depender de requisição HTTP), só que rodando uma vez por dia: gera e
// avisa por e-mail quem está perto do vencimento, e desativa quem já venceu
// sem pagar.
package renovacao

import (
	"log"
	"time"

	"gorm.io/gorm"

	"agendamento/backend/internal/brtime"
	"agendamento/backend/internal/handlers"
	"agendamento/backend/internal/models"
	"agendamento/backend/internal/notifications"
)

const (
	intervaloVerificacao = 24 * time.Hour
	// diasAntecedenciaAviso é "a poucos dias (ex: 3)" do CLAUDE.md — gera o
	// link de renovação e avisa por e-mail a partir desse ponto.
	diasAntecedenciaAviso = 3
)

// Iniciar sobe o laço numa goroutine e retorna na hora — não bloqueia o
// boot do servidor.
func Iniciar(db *gorm.DB, notificador *notifications.Notificador, pagamentoHandler *handlers.PagamentoHandler) {
	go func() {
		for {
			Verificar(db, notificador, pagamentoHandler)
			time.Sleep(intervaloVerificacao)
		}
	}()
}

// Verificar roda uma única passada — exportado à parte de Iniciar pra poder
// ser disparado sob demanda (ex: script de teste), sem esperar o laço real.
func Verificar(db *gorm.DB, notificador *notifications.Notificador, pagamentoHandler *handlers.PagamentoHandler) {
	fuso := brtime.Fuso()
	hoje := brtime.InicioDoDia(time.Now(), fuso)

	avisarVencimentoProximo(db, notificador, pagamentoHandler, hoje)
	desativarVencidos(db, hoje)
}

// avisarVencimentoProximo pega estabelecimentos ativos, não isentos, com
// vencimento dentro de diasAntecedenciaAviso dias (incluindo quem já passou
// do vencimento mas ainda não foi desativado nesta mesma passada) e sem
// nenhum link de renovação pendente — gera o link e manda o e-mail. Ignora
// quem tem ProximoVencimento nil (isento, ou conta ativa anterior a essa
// feature que nunca passou pelo fluxo de pagamento — ver comentário no
// model, não pode desativar retroativamente).
func avisarVencimentoProximo(db *gorm.DB, notificador *notifications.Notificador, pagamentoHandler *handlers.PagamentoHandler, hoje time.Time) {
	limite := hoje.AddDate(0, 0, diasAntecedenciaAviso)

	var estabelecimentos []models.Estabelecimento
	err := db.Where(
		"ativo = ? AND isento = ? AND proximo_vencimento IS NOT NULL AND proximo_vencimento <= ? AND link_pagamento_order_nsu = ?",
		true, false, limite, "",
	).Find(&estabelecimentos).Error
	if err != nil {
		log.Printf("renovação: erro ao buscar estabelecimentos perto do vencimento: %v", err)
		return
	}

	for _, estabelecimento := range estabelecimentos {
		pagamentoHandler.GerarLinkRenovacao(&estabelecimento)
		if estabelecimento.LinkPagamentoURL == "" {
			log.Printf("renovação: não foi possível gerar link pro estabelecimento %d, aviso não enviado", estabelecimento.ID)
			continue
		}

		diasRestantes := diasEntre(hoje, brtime.InicioDoDia(*estabelecimento.ProximoVencimento, hoje.Location()))
		notificador.NotificarRenovacaoPendente(estabelecimento, diasRestantes, estabelecimento.LinkPagamentoURL)
	}
}

// desativarVencidos marca ativo=false quem passou do vencimento (dia
// seguinte ao vencimento em diante — no próprio dia do vencimento a conta
// continua liberada, ver banner no admin) sem pagamento confirmado.
func desativarVencidos(db *gorm.DB, hoje time.Time) {
	resultado := db.Model(&models.Estabelecimento{}).
		Where("ativo = ? AND isento = ? AND proximo_vencimento IS NOT NULL AND proximo_vencimento < ?", true, false, hoje).
		Update("ativo", false)
	if resultado.Error != nil {
		log.Printf("renovação: erro ao desativar estabelecimentos vencidos: %v", resultado.Error)
		return
	}
	if resultado.RowsAffected > 0 {
		log.Printf("renovação: %d estabelecimento(s) desativado(s) por vencimento sem pagamento", resultado.RowsAffected)
	}
}

func diasEntre(hoje, dia time.Time) int {
	return int(dia.Sub(hoje).Hours() / 24)
}
