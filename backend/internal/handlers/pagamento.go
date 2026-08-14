package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/infinitepay"
	"agendamento/backend/internal/models"
)

// ValorMensalidadeCentavos é o preço fixo do plano único (ver CLAUDE.md
// "Modelo de negócio e preço") — em centavos porque é o que a API da
// InfinitePay espera nos itens do link de pagamento.
const ValorMensalidadeCentavos = 1990

type PagamentoHandler struct {
	DB          *gorm.DB
	InfinitePay *infinitepay.Cliente
	FrontendURL string
	BackendURL  string
}

func NewPagamentoHandler(db *gorm.DB, infinitePay *infinitepay.Cliente, frontendURL, backendURL string) *PagamentoHandler {
	return &PagamentoHandler{DB: db, InfinitePay: infinitePay, FrontendURL: frontendURL, BackendURL: backendURL}
}

// GerarLinkPagamento cria o link de pagamento único do estabelecimento e
// grava URL+order_nsu nele. orderNsu fica a cargo de quem chama (cadastro
// inicial usa o ID do estabelecimento; renovação mensal vai usar outro
// formato, ver CLAUDE.md "Renovação mensal"). Não devolve erro pro chamador
// de propósito: se a InfinitePay falhar ou não estiver configurada
// (INFINITEPAY_HANDLE vazia), só loga — o cadastro em si não pode travar
// por causa disso, e a tela pós-cadastro já sabe lidar com
// link_pagamento_url vazio (mostra um contato de fallback).
func (h *PagamentoHandler) GerarLinkPagamento(estabelecimento *models.Estabelecimento, orderNsu string) {
	if h.InfinitePay == nil {
		return
	}

	redirectURL := h.FrontendURL + "/cadastro/pagamento/" + estabelecimento.Slug
	webhookURL := h.BackendURL + "/webhooks/infinitepay"

	url, err := h.InfinitePay.CriarLink(orderNsu, redirectURL, webhookURL, []infinitepay.Item{
		{Quantity: 1, Price: ValorMensalidadeCentavos, Description: "Assinatura AgendHora — " + estabelecimento.Nome},
	})
	if err != nil {
		log.Printf("erro ao gerar link de pagamento InfinitePay pro estabelecimento %d: %v", estabelecimento.ID, err)
		return
	}

	estabelecimento.LinkPagamentoURL = url
	estabelecimento.LinkPagamentoOrderNsu = orderNsu
	if err := h.DB.Model(estabelecimento).Updates(map[string]any{
		"link_pagamento_url":       url,
		"link_pagamento_order_nsu": orderNsu,
	}).Error; err != nil {
		log.Printf("erro ao salvar link de pagamento do estabelecimento %d: %v", estabelecimento.ID, err)
	}
}

type pagamentoStatusResponse struct {
	Ativo            bool   `json:"ativo"`
	Isento           bool   `json:"isento"`
	LinkPagamentoURL string `json:"link_pagamento_url"`
}

func (h *PagamentoHandler) buscarPorSlug(c *gin.Context) (*models.Estabelecimento, bool) {
	var estabelecimento models.Estabelecimento
	err := h.DB.Where("slug = ?", c.Param("slug")).First(&estabelecimento).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "empresa não encontrada"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar empresa"})
		return nil, false
	}
	return &estabelecimento, true
}

// Status é a rota pública que a tela pós-cadastro consulta (inclusive a
// cada refresh, e via polling enquanto fica aberta) pra saber se já pode
// liberar o login. De propósito sem autenticação nem bloqueio de Ativo —
// é exatamente isso que ela existe pra checar.
func (h *PagamentoHandler) Status(c *gin.Context) {
	estabelecimento, ok := h.buscarPorSlug(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, pagamentoStatusResponse{
		Ativo:            estabelecimento.Ativo,
		Isento:           estabelecimento.Isento,
		LinkPagamentoURL: estabelecimento.LinkPagamentoURL,
	})
}

// DiasCicloRenovacao é sempre 30 dias corridos a partir do pagamento — nunca
// uma data fixa de calendário (ver CLAUDE.md "Renovação mensal": quem paga
// atrasado não perde dias de acesso).
const DiasCicloRenovacao = 30

// ativarPagamento marca o estabelecimento como pago e empurra
// ProximoVencimento pra `agora + 30 dias` — vale tanto pro pagamento inicial
// (Ativo ainda false) quanto pra uma renovação confirmada com a conta já
// ativa (renovação adiantada é permitida — ver CLAUDE.md "Renovação
// mensal"), sempre a mesma regra. Sem checagem de "já está ativo, não faz
// nada": os dois chamadores (webhook e confirmarPagamentoPendente) só
// invocam essa função quando existe um link pendente de verdade — e ela
// mesma limpa esse link ao final, então uma segunda tentativa pro mesmo
// pagamento simplesmente não acha mais nada pendente pra confirmar de novo.
func ativarPagamento(db *gorm.DB, estabelecimento *models.Estabelecimento) error {
	vencimento := time.Now().AddDate(0, 0, DiasCicloRenovacao)
	if err := db.Model(estabelecimento).Updates(map[string]any{
		"ativo":                    true,
		"proximo_vencimento":       vencimento,
		"link_pagamento_url":       "",
		"link_pagamento_order_nsu": "",
	}).Error; err != nil {
		return err
	}
	estabelecimento.Ativo = true
	estabelecimento.ProximoVencimento = &vencimento
	estabelecimento.LinkPagamentoURL = ""
	estabelecimento.LinkPagamentoOrderNsu = ""
	return nil
}

// orderNsuRenovacao monta um order_nsu diferente do cadastro inicial (que é
// só o ID) pra cada ciclo de renovação — inclui ano+mês de quando o link foi
// gerado, então nunca colide com um pagamento anterior já consumido (ver
// CLAUDE.md "Renovação mensal").
func orderNsuRenovacao(estabelecimentoID uint) string {
	agora := time.Now()
	return fmt.Sprintf("%d-renov-%04d%02d", estabelecimentoID, agora.Year(), int(agora.Month()))
}

// GerarLinkRenovacao é usado tanto pela rotina diária (ver internal/renovacao)
// quanto pelo botão "renovar agora" no admin. Reaproveita um link pendente
// em vez de gerar de novo — evita links "soltos" duplicados pro mesmo ciclo
// quando a rotina diária já gerou um e o dono clica em "renovar agora" antes
// de pagar.
func (h *PagamentoHandler) GerarLinkRenovacao(estabelecimento *models.Estabelecimento) {
	if estabelecimento.LinkPagamentoOrderNsu != "" {
		return
	}
	h.GerarLinkPagamento(estabelecimento, orderNsuRenovacao(estabelecimento.ID))
}

// Renovar é a ação "renovar agora" — sempre disponível pro dono (tela "Meu
// Plano" e banner de vencimento), a qualquer momento, não só perto do
// vencimento: renovação adiantada é permitida, e segue a mesma regra de
// sempre (data do pagamento + 30 dias), então quem renova antes ganha mais
// dias nesse ciclo, sem tratamento especial.
func (h *PagamentoHandler) Renovar(c *gin.Context) {
	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, auth.EstabelecimentoID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	if estabelecimento.Isento {
		c.JSON(http.StatusBadRequest, gin.H{"error": "estabelecimento isento não precisa renovar"})
		return
	}
	if h.InfinitePay == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "cobrança automática não está configurada"})
		return
	}

	h.GerarLinkRenovacao(&estabelecimento)
	if estabelecimento.LinkPagamentoURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar link de pagamento"})
		return
	}
	c.JSON(http.StatusOK, estabelecimento)
}

type verificarInput struct {
	// TransactionNsu e InvoiceSlug são opcionais — vêm preenchidos quando
	// essa chamada acontece logo depois do redirect de volta da InfinitePay
	// (ver CLAUDE.md "Redirect opcional pra melhorar a UX": a URL de volta
	// traz order_nsu, slug, capture_method e transaction_nsu como query
	// params), o que deixa o payment_check bem mais confiável do que só
	// handle+order_nsu. No clique manual do botão "já paguei, verificar"
	// (sem vir de um redirect), chegam vazios mesmo — best-effort.
	TransactionNsu string `json:"transaction_nsu"`
	InvoiceSlug    string `json:"invoice_slug"`
}

// confirmarPagamentoPendente chama o payment_check só se houver um link de
// pagamento pendente (LinkPagamentoOrderNsu preenchido) e ativa se a
// InfinitePay confirmar. O que decide se há algo a confirmar é existir um
// link pendente — não o valor atual de Ativo: uma renovação acontece com a
// conta ainda ativa, então checar "já está ativo" aqui pularia
// silenciosamente a confirmação de qualquer renovação adiantada.
func (h *PagamentoHandler) confirmarPagamentoPendente(estabelecimento *models.Estabelecimento, transactionNsu, invoiceSlug string) error {
	if estabelecimento.LinkPagamentoOrderNsu == "" || h.InfinitePay == nil {
		return nil
	}
	resultado, err := h.InfinitePay.VerificarPagamento(estabelecimento.LinkPagamentoOrderNsu, transactionNsu, invoiceSlug)
	if err != nil {
		return fmt.Errorf("erro ao consultar payment_check: %w", err)
	}
	if !resultado.Paid {
		return nil
	}
	return ativarPagamento(h.DB, estabelecimento)
}

// Verificar é o fallback manual ("já paguei, verificar") na tela pública
// pós-cadastro, e também o que roda automaticamente quando o cliente volta
// do checkout da InfinitePay pelo redirect_url — chama o payment_check na
// hora, sem esperar o webhook.
func (h *PagamentoHandler) Verificar(c *gin.Context) {
	var input verificarInput
	_ = c.ShouldBindJSON(&input) // corpo é opcional — botão manual não manda nada

	estabelecimento, ok := h.buscarPorSlug(c)
	if !ok {
		return
	}
	if estabelecimento.Isento {
		c.JSON(http.StatusOK, pagamentoStatusResponse{Ativo: true, Isento: true})
		return
	}

	if err := h.confirmarPagamentoPendente(estabelecimento, input.TransactionNsu, input.InvoiceSlug); err != nil {
		log.Printf("verificar pagamento (estabelecimento %d): %v", estabelecimento.ID, err)
	}

	c.JSON(http.StatusOK, pagamentoStatusResponse{
		Ativo:            estabelecimento.Ativo,
		Isento:           estabelecimento.Isento,
		LinkPagamentoURL: estabelecimento.LinkPagamentoURL,
	})
}

// VerificarRenovacao é o equivalente do botão "já paguei, verificar", só que
// pro fluxo autenticado da tela "Meu Plano" — confirma um link de renovação
// pendente sem esperar o webhook, chamado pelo dono depois de pagar uma
// renovação (early ou não).
func (h *PagamentoHandler) VerificarRenovacao(c *gin.Context) {
	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, auth.EstabelecimentoID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	if err := h.confirmarPagamentoPendente(&estabelecimento, "", ""); err != nil {
		log.Printf("verificar renovação (estabelecimento %d): %v", estabelecimento.ID, err)
	}
	c.JSON(http.StatusOK, estabelecimento)
}

type infinitePayWebhookPayload struct {
	InvoiceSlug    string `json:"invoice_slug"`
	TransactionNsu string `json:"transaction_nsu"`
	OrderNsu       string `json:"order_nsu"`
}

// Webhook recebe a confirmação de pagamento da InfinitePay e ativa o
// Estabelecimento correspondente (achado pelo order_nsu). A InfinitePay
// exige resposta em menos de 1 segundo (reenvia em cima de qualquer coisa
// diferente de 200) — por isso essa rota só valida o payload e devolve 200
// na hora; a confirmação de verdade roda depois, numa goroutine, sem
// segurar a resposta HTTP.
//
// A documentação pública da InfinitePay não descreve nenhum mecanismo de
// assinatura/token pra confirmar que a chamada realmente veio dela — como
// contramedida, em vez de confiar cegamente no payload recebido, a
// goroutine faz uma segunda chamada (payment_check) de volta pra
// InfinitePay antes de ativar qualquer coisa.
func (h *PagamentoHandler) Webhook(c *gin.Context) {
	var payload infinitePayWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload inválido"})
		return
	}
	if payload.OrderNsu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_nsu ausente"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "recebido"})

	go h.confirmarPagamentoWebhook(payload)
}

func (h *PagamentoHandler) confirmarPagamentoWebhook(payload infinitePayWebhookPayload) {
	var estabelecimento models.Estabelecimento
	err := h.DB.Where("link_pagamento_order_nsu = ?", payload.OrderNsu).First(&estabelecimento).Error
	if err == gorm.ErrRecordNotFound {
		// nenhum estabelecimento pendente com esse order_nsu (link já
		// consumido, ou nunca existiu) — nada a fazer; a InfinitePay já
		// recebeu 200 e não vai reenviar.
		log.Printf("webhook InfinitePay: nenhum estabelecimento pendente com order_nsu %q", payload.OrderNsu)
		return
	}
	if err != nil {
		log.Printf("webhook InfinitePay: erro ao buscar estabelecimento (order_nsu %q): %v", payload.OrderNsu, err)
		return
	}

	if err := h.confirmarPagamentoPendente(&estabelecimento, payload.TransactionNsu, payload.InvoiceSlug); err != nil {
		log.Printf("webhook InfinitePay (order_nsu %q): %v", payload.OrderNsu, err)
	}
}
