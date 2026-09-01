// Package lembretes é a primeira rotina do projeto que não responde a um
// pedido HTTP: um laço próprio, rodando em goroutine separada do servidor
// Gin, que verifica periodicamente quais agendamentos confirmados estão
// perto de acontecer e ainda não receberam o e-mail de lembrete.
package lembretes

import (
	"log"
	"time"

	"agendamento/backend/internal/models"
	"agendamento/backend/internal/notifications"

	"gorm.io/gorm"
)

const (
	// intervaloVerificacao é de quanto em quanto tempo o laço acorda pra
	// checar se algum agendamento entrou em alguma das janelas de
	// antecedência abaixo.
	intervaloVerificacao = 15 * time.Minute
	// antecedencia é quanto tempo antes do horário marcado o primeiro
	// lembrete sai.
	antecedencia = 3 * time.Hour
	// antecedenciaFinal é o segundo lembrete, bem mais próximo do horário —
	// além do primeiro, não no lugar dele (ver models.Agendamento.LembreteFinalEnviado).
	antecedenciaFinal = 30 * time.Minute
)

// Iniciar sobe o laço de verificação numa goroutine e retorna na hora —
// não bloqueia o boot do servidor. Com notificador desligado (sem
// BREVO_API_KEY), não há e-mail possível, então nem inicia o laço.
func Iniciar(db *gorm.DB, notificador *notifications.Notificador) {
	if notificador == nil {
		log.Println("aviso: notificador desligado — lembretes automáticos não vão ser enviados")
		return
	}
	go func() {
		for {
			Verificar(db, notificador)
			time.Sleep(intervaloVerificacao)
		}
	}()
}

// Verificar roda uma única passada da checagem — exportado à parte de
// Iniciar pra poder ser disparado sob demanda (ex: script de teste), sem
// precisar esperar o laço real. São duas janelas independentes (3h e 30min
// antes), cada uma com seu próprio controle de duplicidade — um agendamento
// recebe os dois lembretes, não um no lugar do outro.
func Verificar(db *gorm.DB, notificador *notifications.Notificador) {
	verificarJanela(db, notificador, "lembrete_enviado", antecedencia, notificador.NotificarLembrete)
	verificarJanela(db, notificador, "lembrete_final_enviado", antecedenciaFinal, notificador.NotificarLembreteFinal)
}

// verificarJanela busca agendamentos confirmados que ainda não receberam o
// lembrete marcado por `campoEnviado` e cujo horário caiu dentro de
// `antecedenciaJanela`, dispara o e-mail e marca o campo — mesma lógica pras
// duas janelas de lembrete, só troca o campo de controle e a antecedência.
func verificarJanela(
	db *gorm.DB,
	notificador *notifications.Notificador,
	campoEnviado string,
	antecedenciaJanela time.Duration,
	notificar func(models.Estabelecimento, models.Agendamento),
) {
	agora := time.Now()
	hoje := time.Date(agora.Year(), agora.Month(), agora.Day(), 0, 0, 0, 0, agora.Location())

	var candidatos []models.Agendamento
	err := db.
		Preload("Cliente").
		Preload("Servico").
		Where("status = ? AND "+campoEnviado+" = ? AND data BETWEEN ? AND ?",
			models.StatusConfirmado, false, hoje, hoje.Add(48*time.Hour)).
		Find(&candidatos).Error
	if err != nil {
		log.Printf("erro ao buscar agendamentos para lembrete (%s): %v", campoEnviado, err)
		return
	}

	for _, agendamento := range candidatos {
		horario, err := combinarDataHora(agendamento.Data, agendamento.Hora)
		if err != nil {
			log.Printf("horário inválido no agendamento %d (%q): %v", agendamento.ID, agendamento.Hora, err)
			continue
		}

		faltam := horario.Sub(agora)
		if faltam <= 0 || faltam > antecedenciaJanela {
			continue
		}

		if agendamento.Cliente.Email == "" {
			continue
		}

		var estabelecimento models.Estabelecimento
		if err := db.First(&estabelecimento, agendamento.EstabelecimentoID).Error; err != nil {
			log.Printf("erro ao buscar estabelecimento %d pro lembrete: %v", agendamento.EstabelecimentoID, err)
			continue
		}

		notificar(estabelecimento, agendamento)

		if err := db.Model(&models.Agendamento{}).Where("id = ?", agendamento.ID).
			Update(campoEnviado, true).Error; err != nil {
			log.Printf("erro ao marcar %s (agendamento %d): %v", campoEnviado, agendamento.ID, err)
		}
	}
}

// combinarDataHora ignora a location da coluna Data (é só um artefato de
// como o Postgres devolve timestamps — normalmente UTC, sem relação com o
// fuso do estabelecimento). Hora é um horário "de parede" sem timezone
// própria, então monta o instante sempre na timezone local do servidor —
// igual o resto do app já faz ao comparar com time.Now() (ver
// handlers.disponibilidade, que compara data/hora "de hoje" do mesmo jeito).
func combinarDataHora(data time.Time, hora string) (time.Time, error) {
	t, err := time.ParseInLocation("15:04", hora, time.Local)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(data.Year(), data.Month(), data.Day(), t.Hour(), t.Minute(), 0, 0, time.Local), nil
}
