// Package infinitepay é o cliente HTTP da API pública de Checkout Integrado
// da InfinitePay (https://www.infinitepay.io/checkout-documentacao) — gera
// link de pagamento único e confere status de pagamento como fallback do
// webhook. A API pública desses dois endpoints não exige Bearer token, só o
// "handle" (InfiniteTag, sem o $) do recebedor — diferente do que o
// CLAUDE.md original supunha; confirmado direto na documentação oficial.
package infinitepay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const (
	urlCriarLink    = "https://api.checkout.infinitepay.io/links"
	urlPaymentCheck = "https://api.checkout.infinitepay.io/payment_check"
)

// Cliente fala com a API da InfinitePay em nome de um recebedor (handle).
type Cliente struct {
	handle     string
	httpClient *http.Client
}

// New retorna nil se handle estiver vazio — o chamador deve tratar um
// Cliente nil como "cobrança automática desligada" (ex: ambiente de
// desenvolvimento sem INFINITEPAY_HANDLE configurada), sem travar o boot.
func New(handle string) *Cliente {
	if handle == "" {
		log.Println("aviso: INFINITEPAY_HANDLE não definida — geração automática de link de pagamento desligada")
		return nil
	}
	return &Cliente{handle: handle, httpClient: &http.Client{Timeout: 15 * time.Second}}
}

// Item é uma linha do carrinho do link de pagamento — preço em centavos.
type Item struct {
	Quantity    int    `json:"quantity"`
	Price       int    `json:"price"`
	Description string `json:"description"`
}

type criarLinkRequest struct {
	Handle      string `json:"handle"`
	Items       []Item `json:"items"`
	OrderNsu    string `json:"order_nsu"`
	RedirectURL string `json:"redirect_url"`
	WebhookURL  string `json:"webhook_url"`
}

type criarLinkResponse struct {
	URL string `json:"url"`
}

// CriarLink gera um link de pagamento único pro order_nsu informado (ver
// models.Estabelecimento.LinkPagamentoOrderNsu). redirectURL é pra onde o
// cliente volta depois de pagar; webhookURL é a rota que a InfinitePay chama
// pra confirmar (ver handlers.PagamentoHandler.Webhook).
func (cl *Cliente) CriarLink(orderNsu, redirectURL, webhookURL string, itens []Item) (string, error) {
	if cl == nil {
		return "", fmt.Errorf("cliente InfinitePay não configurado")
	}

	corpo, err := json.Marshal(criarLinkRequest{
		Handle:      cl.handle,
		Items:       itens,
		OrderNsu:    orderNsu,
		RedirectURL: redirectURL,
		WebhookURL:  webhookURL,
	})
	if err != nil {
		return "", fmt.Errorf("erro ao preparar requisição: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, urlCriarLink, bytes.NewReader(corpo))
	if err != nil {
		return "", fmt.Errorf("erro ao montar requisição: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cl.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("erro ao chamar InfinitePay: %w", err)
	}
	defer resp.Body.Close()

	corpoResposta, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("erro ao ler resposta da InfinitePay: %w", err)
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("InfinitePay respondeu %d: %s", resp.StatusCode, string(corpoResposta))
	}

	var resposta criarLinkResponse
	if err := json.Unmarshal(corpoResposta, &resposta); err != nil {
		return "", fmt.Errorf("erro ao interpretar resposta da InfinitePay: %w", err)
	}
	if resposta.URL == "" {
		return "", fmt.Errorf("InfinitePay não devolveu url do link")
	}
	return resposta.URL, nil
}

type paymentCheckRequest struct {
	Handle         string `json:"handle"`
	OrderNsu       string `json:"order_nsu"`
	TransactionNsu string `json:"transaction_nsu,omitempty"`
	Slug           string `json:"slug,omitempty"`
}

// PaymentCheckResultado é a resposta crua da InfinitePay — Paid é a fonte
// da verdade sobre se o pagamento realmente aconteceu.
type PaymentCheckResultado struct {
	Success      bool `json:"success"`
	Paid         bool `json:"paid"`
	Amount       int  `json:"amount"`
	PaidAmount   int  `json:"paid_amount"`
	Installments int  `json:"installments"`
}

// VerificarPagamento chama o endpoint payment_check — usado tanto como
// segunda confirmação depois de um webhook recebido (transactionNsu/slug
// vêm do próprio payload do webhook) quanto pelo botão manual "já paguei,
// verificar" (chamado só com handle+order_nsu, sem transactionNsu/slug
// ainda — a InfinitePay não documenta esses dois como obrigatórios).
func (cl *Cliente) VerificarPagamento(orderNsu, transactionNsu, slug string) (PaymentCheckResultado, error) {
	if cl == nil {
		return PaymentCheckResultado{}, fmt.Errorf("cliente InfinitePay não configurado")
	}

	corpo, err := json.Marshal(paymentCheckRequest{
		Handle:         cl.handle,
		OrderNsu:       orderNsu,
		TransactionNsu: transactionNsu,
		Slug:           slug,
	})
	if err != nil {
		return PaymentCheckResultado{}, fmt.Errorf("erro ao preparar requisição: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, urlPaymentCheck, bytes.NewReader(corpo))
	if err != nil {
		return PaymentCheckResultado{}, fmt.Errorf("erro ao montar requisição: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cl.httpClient.Do(req)
	if err != nil {
		return PaymentCheckResultado{}, fmt.Errorf("erro ao chamar InfinitePay: %w", err)
	}
	defer resp.Body.Close()

	corpoResposta, err := io.ReadAll(resp.Body)
	if err != nil {
		return PaymentCheckResultado{}, fmt.Errorf("erro ao ler resposta da InfinitePay: %w", err)
	}
	if resp.StatusCode >= 300 {
		return PaymentCheckResultado{}, fmt.Errorf("InfinitePay respondeu %d: %s", resp.StatusCode, string(corpoResposta))
	}

	var resultado PaymentCheckResultado
	if err := json.Unmarshal(corpoResposta, &resultado); err != nil {
		return PaymentCheckResultado{}, fmt.Errorf("erro ao interpretar resposta da InfinitePay: %w", err)
	}
	return resultado, nil
}
