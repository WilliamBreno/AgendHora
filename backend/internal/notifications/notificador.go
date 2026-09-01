package notifications

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"agendamento/backend/internal/models"
)

const brevoEnvioURL = "https://api.brevo.com/v3/smtp/email"

// Notificador dispara os e-mails de confirmação (cliente) e aviso (dono) a
// cada novo agendamento, via API transacional do Brevo (REST simples — sem
// SDK, a chamada é só um POST com JSON). Chamadas são feitas em goroutine
// pelo handler: um e-mail que falha ou demora não deve derrubar nem atrasar
// a criação do agendamento em si.
type Notificador struct {
	apiKey        string
	remetenteNome string
	remetenteMail string
	httpClient    *http.Client
}

// New retorna nil se apiKey estiver vazia — o chamador deve tratar um
// Notificador nil como "notificações desligadas" em vez de travar o boot
// do servidor por falta de configuração de e-mail.
func New(apiKey, remetenteNome, remetenteMail string) *Notificador {
	if apiKey == "" {
		log.Println("aviso: BREVO_API_KEY não definida — notificações por e-mail desligadas")
		return nil
	}
	return &Notificador{
		apiKey:        apiKey,
		remetenteNome: remetenteNome,
		remetenteMail: remetenteMail,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (n *Notificador) NotificarNovoAgendamento(estabelecimento models.Estabelecimento, agendamento models.Agendamento) {
	if n == nil {
		return
	}

	dataFormatada := agendamento.Data.Format("02/01/2006")

	if agendamento.Cliente.Email != "" {
		n.enviar(
			agendamento.Cliente.Email,
			"Agendamento confirmado — "+estabelecimento.Nome,
			emailClienteHTML(estabelecimento, agendamento, dataFormatada),
		)
	}

	if estabelecimento.Email != "" {
		n.enviar(
			estabelecimento.Email,
			"Novo agendamento: "+agendamento.Cliente.Nome,
			emailDonoHTML(estabelecimento, agendamento, dataFormatada),
		)
	}
}

func (n *Notificador) NotificarCancelamento(estabelecimento models.Estabelecimento, agendamento models.Agendamento) {
	if n == nil || agendamento.Cliente.Email == "" {
		return
	}
	dataFormatada := agendamento.Data.Format("02/01/2006")
	n.enviar(
		agendamento.Cliente.Email,
		"Agendamento cancelado — "+estabelecimento.Nome,
		emailCancelamentoHTML(estabelecimento, agendamento, dataFormatada),
	)
}

// NotificarLembrete manda o lembrete automático algumas horas antes do
// horário marcado (ver internal/lembretes, que decide quando chamar isso).
// Sem e-mail cadastrado do cliente, não há lembrete possível — só o
// e-mail de confirmação, que também vai pro dono, é obrigatório hoje.
func (n *Notificador) NotificarLembrete(estabelecimento models.Estabelecimento, agendamento models.Agendamento) {
	if n == nil || agendamento.Cliente.Email == "" {
		return
	}
	dataFormatada := agendamento.Data.Format("02/01/2006")
	n.enviar(
		agendamento.Cliente.Email,
		"Lembrete: seu horário é daqui a pouco — "+estabelecimento.Nome,
		emailLembreteHTML(estabelecimento, agendamento, dataFormatada),
	)
}

// NotificarLembreteFinal é o segundo lembrete, 30 minutos antes do horário
// (ver internal/lembretes) — além do lembrete de algumas horas antes, não no
// lugar dele.
func (n *Notificador) NotificarLembreteFinal(estabelecimento models.Estabelecimento, agendamento models.Agendamento) {
	if n == nil || agendamento.Cliente.Email == "" {
		return
	}
	dataFormatada := agendamento.Data.Format("02/01/2006")
	n.enviar(
		agendamento.Cliente.Email,
		"Seu horário é daqui a 30 minutos — "+estabelecimento.Nome,
		emailLembreteFinalHTML(estabelecimento, agendamento, dataFormatada),
	)
}

// NotificarReagendamento é o aviso automático de inatividade (ver
// internal/reagendamento) — sugestaoTexto vazio significa que não achou o
// mesmo horário livre de novo, e o e-mail cai num CTA genérico de agendar.
func (n *Notificador) NotificarReagendamento(
	estabelecimento models.Estabelecimento,
	cliente models.Cliente,
	diasSemAgendar int,
	link, sugestaoTexto string,
) {
	if n == nil || cliente.Email == "" {
		return
	}
	n.enviar(
		cliente.Email,
		"Faz tempo que a gente não te vê — "+estabelecimento.Nome,
		emailReagendamentoHTML(estabelecimento, cliente, diasSemAgendar, link, sugestaoTexto),
	)
}

// NotificarConviteProfissional manda o link de cadastro pro profissional
// auxiliar recém-convidado pelo dono. link já vem pronto (ver
// handlers.ProfissionalHandler, que também devolve esse mesmo link na
// resposta da API — o dono pode copiá-lo e mandar manualmente se o e-mail
// não chegar).
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

// NotificarRenovacaoPendente é a rotina diária de renovação avisando o dono
// (ver internal/renovacao) — dispara quando o vencimento está a poucos dias
// (ou já passou, mas sem link gerado ainda). Sem e-mail cadastrado do
// estabelecimento, não há como avisar automaticamente; o dono ainda vê o
// banner de vencimento dentro do admin.
func (n *Notificador) NotificarRenovacaoPendente(estabelecimento models.Estabelecimento, diasRestantes int, link string) {
	if n == nil || estabelecimento.Email == "" {
		return
	}
	assunto := "Sua assinatura AgendHora vence em breve"
	if diasRestantes <= 0 {
		assunto = "Sua assinatura AgendHora venceu"
	}
	n.enviar(estabelecimento.Email, assunto, emailRenovacaoPendenteHTML(estabelecimento, diasRestantes, link))
}

// NotificarResumoSemanal é o e-mail automático de toda segunda-feira pro
// dono (ver internal/resumosemanal) — faturamento e número de agendamentos
// da semana anterior, mais a sugestão do dashboard daquele momento. Sem
// e-mail cadastrado no estabelecimento, não há como avisar.
func (n *Notificador) NotificarResumoSemanal(
	estabelecimento models.Estabelecimento,
	faturamento float64,
	quantidade int,
	sugestaoTitulo, sugestaoDescricao string,
	temSugestao bool,
) {
	if n == nil || estabelecimento.Email == "" {
		return
	}
	n.enviar(
		estabelecimento.Email,
		"Resumo da semana — "+estabelecimento.Nome,
		emailResumoSemanalHTML(estabelecimento, faturamento, quantidade, sugestaoTitulo, sugestaoDescricao, temSugestao),
	)
}

type brevoDestinatario struct {
	Email string `json:"email"`
}

type brevoRemetente struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type brevoEnvioRequest struct {
	Sender      brevoRemetente      `json:"sender"`
	To          []brevoDestinatario `json:"to"`
	Subject     string              `json:"subject"`
	HTMLContent string              `json:"htmlContent"`
}

func (n *Notificador) enviar(destinatario, assunto, html string) {
	corpo, err := json.Marshal(brevoEnvioRequest{
		Sender:      brevoRemetente{Name: n.remetenteNome, Email: n.remetenteMail},
		To:          []brevoDestinatario{{Email: destinatario}},
		Subject:     assunto,
		HTMLContent: html,
	})
	if err != nil {
		log.Printf("erro ao preparar e-mail para %s: %v", destinatario, err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, brevoEnvioURL, bytes.NewReader(corpo))
	if err != nil {
		log.Printf("erro ao montar requisição de e-mail para %s: %v", destinatario, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("api-key", n.apiKey)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		log.Printf("erro ao enviar e-mail para %s: %v", destinatario, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respostaBruta, _ := io.ReadAll(resp.Body)
		log.Printf("erro ao enviar e-mail para %s: brevo respondeu %d: %s", destinatario, resp.StatusCode, string(respostaBruta))
	}
}
