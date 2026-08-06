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
	client      *resend.Client
	from        string
	frontendURL string
}

// New retorna nil se apiKey estiver vazia — o chamador deve tratar um
// Notificador nil como "notificações desligadas" em vez de travar o boot
// do servidor por falta de configuração de e-mail. frontendURL é usado pra
// montar links (ex: o de aceite de convite de profissional).
func New(apiKey, from, frontendURL string) *Notificador {
	if apiKey == "" {
		log.Println("aviso: RESEND_API_KEY não definida — notificações por e-mail desligadas")
		return nil
	}
	return &Notificador{client: resend.NewClient(apiKey), from: from, frontendURL: frontendURL}
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
// auxiliar recém-convidado pelo dono.
func (n *Notificador) NotificarConviteProfissional(estabelecimento models.Estabelecimento, convite models.ConviteProfissional) {
	if n == nil {
		return
	}
	link := n.frontendURL + "/convite/" + convite.Token
	n.enviar(
		convite.Email,
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
