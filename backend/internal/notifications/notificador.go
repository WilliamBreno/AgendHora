package notifications

import (
	"log"

	"github.com/resend/resend-go/v2"

	"agendamento/backend/internal/models"
)

// Notificador dispara os e-mails de confirmação (cliente) e aviso (dono) a
// cada novo agendamento. Chamadas são feitas em goroutine pelo handler: um
// e-mail que falha ou demora não deve derrubar nem atrasar a criação do
// agendamento em si.
type Notificador struct {
	client *resend.Client
	from   string
}

// New retorna nil se apiKey estiver vazia — o chamador deve tratar um
// Notificador nil como "notificações desligadas" em vez de travar o boot
// do servidor por falta de configuração de e-mail.
func New(apiKey, from string) *Notificador {
	if apiKey == "" {
		log.Println("aviso: RESEND_API_KEY não definida — notificações por e-mail desligadas")
		return nil
	}
	return &Notificador{client: resend.NewClient(apiKey), from: from}
}

func (n *Notificador) NotificarNovoAgendamento(estabelecimento models.Estabelecimento, agendamento models.Agendamento) {
	if n == nil {
		return
	}

	dataFormatada := agendamento.Data.Format("02/01/2006")

	if agendamento.ClienteEmail != "" {
		n.enviar(
			agendamento.ClienteEmail,
			"Agendamento confirmado — "+estabelecimento.Nome,
			emailClienteHTML(estabelecimento, agendamento, dataFormatada),
		)
	}

	if estabelecimento.Email != "" {
		n.enviar(
			estabelecimento.Email,
			"Novo agendamento: "+agendamento.ClienteNome,
			emailDonoHTML(estabelecimento, agendamento, dataFormatada),
		)
	}
}

func (n *Notificador) NotificarCancelamento(estabelecimento models.Estabelecimento, agendamento models.Agendamento) {
	if n == nil || agendamento.ClienteEmail == "" {
		return
	}
	dataFormatada := agendamento.Data.Format("02/01/2006")
	n.enviar(
		agendamento.ClienteEmail,
		"Agendamento cancelado — "+estabelecimento.Nome,
		emailCancelamentoHTML(estabelecimento, agendamento, dataFormatada),
	)
}

// NotificarConviteProfissional manda o link de cadastro pro profissional
// auxiliar recém-convidado pelo dono. link já vem pronto (ver
// handlers.ProfissionalHandler, que também devolve esse mesmo link na
// resposta da API — o dono pode copiá-lo e mandar manualmente se o e-mail
// não chegar, por exemplo por causa do modo sandbox do Resend).
func (n *Notificador) NotificarConviteProfissional(estabelecimento models.Estabelecimento, email, link string) {
	if n == nil {
		return
	}
	n.enviar(
		email,
		"Convite para fazer parte de "+estabelecimento.Nome+" no AgendHora",
		emailConviteProfissionalHTML(estabelecimento, link),
	)
}

func (n *Notificador) enviar(destinatario, assunto, html string) {
	_, err := n.client.Emails.Send(&resend.SendEmailRequest{
		From:    n.from,
		To:      []string{destinatario},
		Subject: assunto,
		Html:    html,
	})
	if err != nil {
		log.Printf("erro ao enviar e-mail para %s: %v", destinatario, err)
	}
}
