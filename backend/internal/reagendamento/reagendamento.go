// Package reagendamento é a rotina diária que avisa por e-mail um cliente
// que não agenda há muito tempo (ver CLAUDE.md — configurável em
// Configurações via Estabelecimento.DiasReagendamento) — mesma
// infraestrutura de cron do internal/lembretes, internal/renovacao e
// internal/resumosemanal, só que checando inatividade de cliente em vez de
// horário de agendamento ou vencimento de assinatura.
package reagendamento

import (
	"fmt"
	"log"
	"net/url"
	"strconv"
	"time"

	"gorm.io/gorm"

	"agendamento/backend/internal/brtime"
	"agendamento/backend/internal/handlers"
	"agendamento/backend/internal/models"
	"agendamento/backend/internal/notifications"
)

const (
	intervaloVerificacao = 24 * time.Hour
	// semanasBuscaSugestao é até quantas semanas à frente
	// handlers.ProximoHorarioDisponivel procura o mesmo dia da
	// semana/horário do último agendamento livre de novo.
	semanasBuscaSugestao = 8
)

var diasSemanaPt = []string{
	"domingo", "segunda-feira", "terça-feira", "quarta-feira",
	"quinta-feira", "sexta-feira", "sábado",
}

// Iniciar sobe o laço numa goroutine e retorna na hora — não bloqueia o
// boot do servidor. Sem notificador (sem BREVO_API_KEY), não há e-mail
// possível, então nem inicia o laço.
func Iniciar(db *gorm.DB, notificador *notifications.Notificador, frontendURL string) {
	if notificador == nil {
		log.Println("aviso: notificador desligado — aviso automático de reagendamento não vai ser enviado")
		return
	}
	go func() {
		for {
			Verificar(db, notificador, frontendURL)
			time.Sleep(intervaloVerificacao)
		}
	}()
}

// Verificar roda uma única passada — exportado à parte de Iniciar pra poder
// ser disparado sob demanda (ex: script de teste), sem esperar o laço real.
func Verificar(db *gorm.DB, notificador *notifications.Notificador, frontendURL string) {
	hoje := brtime.InicioDoDia(time.Now(), brtime.Fuso())

	var estabelecimentos []models.Estabelecimento
	err := db.Where("ativo = ? AND dias_reagendamento IS NOT NULL", true).Find(&estabelecimentos).Error
	if err != nil {
		log.Printf("reagendamento: erro ao buscar estabelecimentos: %v", err)
		return
	}

	for _, estabelecimento := range estabelecimentos {
		verificarEstabelecimento(db, notificador, frontendURL, estabelecimento, hoje)
	}
}

// verificarEstabelecimento acha, dentro de um estabelecimento, todo cliente
// cujo último agendamento confirmado caiu há DiasReagendamento dias ou mais
// — mesma conta de "cliente sumido" (ver handlers.ClienteHandler), só que
// com o limiar configurável do estabelecimento em vez do fixo de 60 dias, e
// disparando um e-mail em vez de só um badge na tela.
func verificarEstabelecimento(
	db *gorm.DB, notificador *notifications.Notificador, frontendURL string,
	estabelecimento models.Estabelecimento, hoje time.Time,
) {
	limite := hoje.AddDate(0, 0, -*estabelecimento.DiasReagendamento)

	var linhas []struct {
		ClienteID uint
		Ultima    time.Time
	}
	err := db.Model(&models.Agendamento{}).
		Select("cliente_id, MAX(data) as ultima").
		Where("estabelecimento_id = ? AND status = ?", estabelecimento.ID, models.StatusConfirmado).
		Group("cliente_id").
		Having("MAX(data) <= ?", limite).
		Scan(&linhas).Error
	if err != nil {
		log.Printf("reagendamento: erro ao buscar clientes inativos do estabelecimento %d: %v", estabelecimento.ID, err)
		return
	}
	if len(linhas) == 0 {
		return
	}

	ids := make([]uint, 0, len(linhas))
	ultimaPorCliente := map[uint]time.Time{}
	for _, l := range linhas {
		ids = append(ids, l.ClienteID)
		ultimaPorCliente[l.ClienteID] = l.Ultima
	}

	// só clientes com e-mail cadastrado — sem isso não há como avisar
	// automaticamente (mesma limitação do lembrete de agendamento).
	var clientes []models.Cliente
	if err := db.Where("id IN ? AND email <> ?", ids, "").Find(&clientes).Error; err != nil {
		log.Printf("reagendamento: erro ao buscar clientes do estabelecimento %d: %v", estabelecimento.ID, err)
		return
	}

	for _, cliente := range clientes {
		ultima := ultimaPorCliente[cliente.ID]
		// já avisado depois desse último agendamento? não repete todo dia
		// enquanto ele continuar inativo — só dispara de novo se ele
		// agendar de novo e sumir mais uma vez.
		if cliente.UltimoAvisoReagendamentoEm != nil && !cliente.UltimoAvisoReagendamentoEm.Before(ultima) {
			continue
		}
		enviarAviso(db, notificador, frontendURL, estabelecimento, cliente, ultima, hoje)
	}
}

func enviarAviso(
	db *gorm.DB, notificador *notifications.Notificador, frontendURL string,
	estabelecimento models.Estabelecimento, cliente models.Cliente, ultimaData, hoje time.Time,
) {
	var ultimoAgendamento models.Agendamento
	err := db.Preload("Servico").
		Where(
			"cliente_id = ? AND estabelecimento_id = ? AND status = ? AND data = ?",
			cliente.ID, estabelecimento.ID, models.StatusConfirmado, ultimaData,
		).
		Order("hora desc").
		First(&ultimoAgendamento).Error
	if err != nil {
		log.Printf("reagendamento: erro ao buscar último agendamento do cliente %d: %v", cliente.ID, err)
		return
	}

	diasSemAgendar := int(hoje.Sub(ultimaData).Hours() / 24)

	// tenta reaproveitar o mesmo dia da semana/horário do último
	// agendamento — se não achar nada livre nas próximas semanas, o e-mail
	// cai num link genérico de agendar, sem nada pré-selecionado.
	sugestaoData, err := handlers.ProximoHorarioDisponivel(
		db, estabelecimento.ID, ultimoAgendamento.ProfissionalID, ultimoAgendamento.Servico,
		ultimaData.Weekday(), ultimoAgendamento.Hora, hoje, semanasBuscaSugestao,
	)
	if err != nil {
		log.Printf("reagendamento: erro ao buscar horário sugerido pro cliente %d: %v", cliente.ID, err)
		sugestaoData = nil
	}

	link := montarLink(frontendURL, estabelecimento.Slug, ultimoAgendamento, cliente, sugestaoData)
	sugestaoTexto := ""
	if sugestaoData != nil {
		sugestaoTexto = formatarSugestao(*sugestaoData, ultimoAgendamento.Hora)
	}

	notificador.NotificarReagendamento(estabelecimento, cliente, diasSemAgendar, link, sugestaoTexto)

	agora := time.Now()
	if err := db.Model(&cliente).Update("ultimo_aviso_reagendamento_em", agora).Error; err != nil {
		log.Printf("reagendamento: erro ao marcar aviso enviado (cliente %d): %v", cliente.ID, err)
	}
}

// montarLink devolve o link público de agendamento — sem sugestão, é só o
// link normal do estabelecimento; com sugestão, vem com o serviço,
// profissional, data e horário pré-selecionados via query string (a página
// pública lê esses parâmetros e pula direto pra confirmação, mas o cliente
// sempre precisa clicar em "Confirmar agendamento" — nunca reserva sozinho
// só por causa do link ser aberto, o que evitaria um scanner de e-mail ou
// pré-visualização criando um agendamento sem ninguém querer).
func montarLink(frontendURL, slug string, agendamento models.Agendamento, cliente models.Cliente, sugestaoData *time.Time) string {
	base := frontendURL + "/" + slug
	if sugestaoData == nil {
		return base
	}
	valores := url.Values{}
	valores.Set("servico_id", strconv.FormatUint(uint64(agendamento.ServicoID), 10))
	valores.Set("profissional_id", strconv.FormatUint(uint64(agendamento.ProfissionalID), 10))
	valores.Set("data", sugestaoData.Format("2006-01-02"))
	valores.Set("hora", agendamento.Hora)
	valores.Set("nome", cliente.Nome)
	valores.Set("telefone", cliente.Telefone)
	return base + "?" + valores.Encode()
}

func formatarSugestao(data time.Time, hora string) string {
	return fmt.Sprintf("%s, %s às %s", diasSemanaPt[int(data.Weekday())], data.Format("02/01"), hora)
}
