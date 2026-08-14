// Package resumosemanal é a rotina de segunda-feira que manda o dono um
// e-mail com o resumo da semana anterior (ver CLAUDE.md "Lembretes
// automáticos" — "Resumo semanal por e-mail pro dono") — mesma
// infraestrutura de cron do internal/lembretes e do internal/renovacao, só
// que com um gatilho semanal em vez de diário/horário.
package resumosemanal

import (
	"log"
	"time"

	"gorm.io/gorm"

	"agendamento/backend/internal/brtime"
	"agendamento/backend/internal/handlers"
	"agendamento/backend/internal/models"
	"agendamento/backend/internal/notifications"
)

const intervaloVerificacao = 24 * time.Hour

// Iniciar sobe o laço numa goroutine e retorna na hora — não bloqueia o
// boot do servidor. Sem notificador (sem BREVO_API_KEY), não há e-mail
// possível, então nem inicia o laço.
func Iniciar(db *gorm.DB, notificador *notifications.Notificador) {
	if notificador == nil {
		log.Println("aviso: notificador desligado — resumo semanal por e-mail não vai ser enviado")
		return
	}
	go func() {
		for {
			Verificar(db, notificador)
			time.Sleep(intervaloVerificacao)
		}
	}()
}

// Verificar roda uma única passada — exportado à parte de Iniciar pra poder
// ser disparado sob demanda (ex: script de teste), sem esperar o laço real.
// Só faz alguma coisa às segundas-feiras (fuso do Brasil) e só uma vez por
// estabelecimento naquele dia — controlado por
// Estabelecimento.UltimoResumoSemanalEm, pra sobreviver a reinícios do
// processo sem duplicar o envio.
func Verificar(db *gorm.DB, notificador *notifications.Notificador) {
	fuso := brtime.Fuso()
	hoje := brtime.InicioDoDia(time.Now(), fuso)
	if hoje.Weekday() != time.Monday {
		return
	}

	var estabelecimentos []models.Estabelecimento
	err := db.Where("ativo = ? AND email <> ?", true, "").
		Where("ultimo_resumo_semanal_em IS NULL OR ultimo_resumo_semanal_em < ?", hoje).
		Find(&estabelecimentos).Error
	if err != nil {
		log.Printf("resumo semanal: erro ao buscar estabelecimentos: %v", err)
		return
	}

	// semana anterior = segunda a domingo passados, já que hoje é segunda.
	inicioSemanaPassada := hoje.AddDate(0, 0, -7)
	fimSemanaPassada := hoje.AddDate(0, 0, -1)

	for _, estabelecimento := range estabelecimentos {
		faturamento, quantidade, err := handlers.ResumoSemana(
			db, estabelecimento.ID, inicioSemanaPassada, fimSemanaPassada,
		)
		if err != nil {
			log.Printf("resumo semanal: erro ao calcular resumo do estabelecimento %d: %v", estabelecimento.ID, err)
			continue
		}
		sugestaoTitulo, sugestaoDescricao, temSugestao := handlers.SugestaoPrincipal(db, estabelecimento.ID)

		notificador.NotificarResumoSemanal(
			estabelecimento, faturamento, quantidade, sugestaoTitulo, sugestaoDescricao, temSugestao,
		)

		agora := time.Now()
		if err := db.Model(&estabelecimento).Update("ultimo_resumo_semanal_em", agora).Error; err != nil {
			log.Printf("resumo semanal: erro ao marcar envio do estabelecimento %d: %v", estabelecimento.ID, err)
		}
	}
}
