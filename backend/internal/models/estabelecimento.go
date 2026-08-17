package models

import (
	"time"

	"gorm.io/datatypes"
)

// IconesPadraoDefault é o conjunto inicial de ícones sugerido ao criar o
// estabelecimento. O dono pode adicionar/remover livremente depois em
// Configurações — o seletor de ícone do serviço sempre lê de IconesPadrao,
// nunca deste array.
var IconesPadraoDefault = []string{
	"Scissors", "Sparkles", "Heart", "Palette", "Brush", "Flower2",
	"Hand", "Droplet", "Droplets", "Sun", "Star", "Gem",
	"Syringe", "HandHeart", "Wind", "Feather", "Bath", "SprayCan",
	"Flame", "Leaf", "Smile", "ShowerHead",
}

// Estabelecimento representa uma empresa cadastrada na plataforma (multi-tenant:
// cada uma tem seus próprios usuários, serviços e agendamentos).
type Estabelecimento struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Nome     string `gorm:"not null" json:"nome"`
	Telefone string `json:"telefone"`
	Endereco string `json:"endereco"`
	// Email recebe a notificação de "novo agendamento" (ver internal/notifications).
	Email string `json:"email"`

	// Slug identifica a empresa na URL pública (ex: agendhora.app/salao-da-maria).
	// Gerado a partir do nome no cadastro, único, nunca muda depois de criado.
	// Sem "not null" no banco de propósito: isso permite ADD COLUMN em cima de
	// linhas existentes sem quebrar a migration; a obrigatoriedade é garantida
	// na aplicação (handlers.Registro sempre define um slug, e MigrarSlugsLegados
	// preenche qualquer linha antiga que não tinha esse campo).
	Slug string `gorm:"uniqueIndex" json:"slug"`

	// Logo é a imagem da empresa como data URI base64 (ex: "data:image/png;base64,...").
	// Guardada direto no banco por simplicidade — a v1 não precisa de um serviço
	// de armazenamento de arquivos à parte pra logos, que são pequenas.
	Logo string `json:"logo"`

	// HorarioFuncionamento guarda o horário de funcionamento por dia da semana, ex:
	// {"segunda": {"abre": "09:00", "fecha": "18:00", "fechado": false}, ...}
	HorarioFuncionamento datatypes.JSON `json:"horario_funcionamento"`

	// IconesPadrao é a lista configurável de nomes de ícones lucide-react
	// disponíveis no seletor de ícone do cadastro de serviço, ex: ["Scissors", "Heart"].
	IconesPadrao datatypes.JSON `json:"icones_padrao"`

	// AvisoAtivo/AvisoTexto controlam o aviso/anúncio chamativo opcional que
	// aparece como uma faixa na página pública, sem bloquear o agendamento
	// (o cliente pode fechá-lo). AvisoCorTexto/AvisoCorFundo são opcionais
	// (formato hex, ex: "#0C7C71") — vazios significam "usar o visual padrão".
	AvisoAtivo    bool   `gorm:"not null;default:false" json:"aviso_ativo"`
	AvisoTexto    string `json:"aviso_texto"`
	AvisoCorTexto string `json:"aviso_cor_texto"`
	AvisoCorFundo string `json:"aviso_cor_fundo"`

	// Plano é a string do plano contratado — hoje sempre "padrao" (só existe
	// um plano, tudo incluso). Guardado desde já pra não exigir migration de
	// dado quando outros planos forem definidos no futuro.
	Plano string `gorm:"not null;default:padrao" json:"plano"`
	// Ativo controla se o acesso está liberado enquanto a cobrança é manual
	// (Pix) — ver internal/auth.ExigirEstabelecimentoAtivo e
	// handlers.SlugMiddleware, que bloqueiam admin e página pública quando
	// false. default:true de propósito: não pode bloquear retroativamente
	// os estabelecimentos que já existem e já usam o sistema — só nasce
	// false pra cadastros novos feitos pelo fluxo público (ver
	// handlers.Cadastro), até o dono confirmar o pagamento.
	Ativo bool `gorm:"not null;default:true" json:"ativo"`
	// Isento marca quem nunca deve ser cobrado (uso pessoal do dono do
	// projeto — ver models.EmailIsento) — separado de Ativo de propósito:
	// Ativo sozinho não diz se é isento pra sempre ou um pagante em dia, e
	// uma futura cobrança automática precisa dessa distinção pra não tentar
	// cobrar quem deveria continuar de graça.
	Isento bool `gorm:"not null;default:false" json:"isento"`
	// IsentoAte é até quando a isenção vale — nil quando Isento=false, ou
	// quando a isenção é "sempre" (EmailIsento.DuracaoDias nil no cadastro).
	// Com data, Bloqueado() passa a negar acesso automaticamente depois
	// dela, sem precisar de nenhuma rotina/cron: é só mais uma condição
	// checada nos mesmos três pontos que já bloqueiam por Ativo=false
	// (login, sessão aberta, página pública).
	IsentoAte *time.Time `json:"isento_ate"`

	// ProximoVencimento é sempre `data do último pagamento + 30 dias` (nunca
	// uma data fixa de calendário — ver CLAUDE.md "Renovação mensal") —
	// atualizado a cada pagamento confirmado, inicial ou renovação (ver
	// handlers.ativarPagamento). Nil pra quem é isento ou pra contas ativas
	// anteriores a essa feature que nunca passaram pelo fluxo de pagamento —
	// a rotina diária de renovação ignora quem tem esse campo nil, pra não
	// desativar retroativamente ninguém.
	ProximoVencimento *time.Time `json:"proximo_vencimento"`

	// UltimoResumoSemanalEm marca quando o último resumo semanal por e-mail
	// (ver internal/resumosemanal) foi enviado — evita reenviar no mesmo dia
	// se o processo reiniciar, sem precisar de nenhum estado além desse
	// timestamp.
	UltimoResumoSemanalEm *time.Time `json:"-"`

	// DescontoProfissionalPercentual é o desconto padrão (0-100) aplicado
	// automaticamente quando um profissional (dono ou auxiliar) compra um
	// produto internamente — ver CLAUDE.md "Cadastro de produtos". Nil =
	// nenhum desconto configurado (compra interna sai pelo preço cheio até
	// o dono definir um valor em Configurações). Fica só como referência
	// pra pré-preencher a venda; cada VendaProduto guarda o percentual
	// realmente aplicado, então mudar isso aqui não altera vendas passadas.
	DescontoProfissionalPercentual *float64 `json:"desconto_profissional_percentual"`

	// LinkPagamentoURL é o link de pagamento único (InfinitePay Checkout
	// Integrado) gerado pro ciclo de cobrança atual — mostrado na tela
	// pós-cadastro e, na renovação mensal, na tela "Meu Plano". Vazio quando
	// isento, ou quando ainda não foi gerado (ex: INFINITEPAY_HANDLE não
	// configurado — ver internal/infinitepay).
	LinkPagamentoURL string `json:"link_pagamento_url"`
	// Segmento controla o que aparece em destaque nas telas (ex: "tatuagem"
	// mostra sinal + link de referência em destaque no painel do agendamento)
	// — nunca lógica de backend separada por tipo de negócio, os campos que
	// ele afeta (Servico.Preco opcional, Agendamento.ValorFinal/ValorSinal/
	// SinalPago/LinkReferencia) já são genéricos e valem pra qualquer
	// estabelecimento. Trocado direto no banco pelo dono do projeto — não é
	// self-service do dono do estabelecimento nesta v1 (ver CLAUDE.md
	// "Segmentos de negócio").
	Segmento string `gorm:"not null;default:geral" json:"segmento"`

	// LinkPagamentoOrderNsu é o order_nsu enviado à InfinitePay nesse link —
	// é como o webhook e o botão "já paguei, verificar" acham de volta qual
	// Estabelecimento pagou (ver handlers.PagamentoHandler). No cadastro
	// inicial é o próprio ID do estabelecimento; muda a cada ciclo de
	// renovação. Fica vazio de novo assim que o pagamento é confirmado —
	// um link já usado não deve mais bater com nenhum webhook novo.
	LinkPagamentoOrderNsu string `gorm:"index" json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Bloqueado decide se o acesso deve ser negado — ativo=false (inadimplência,
// ver handlers.Registro/ExigirEstabelecimentoAtivo) ou isenção temporária já
// vencida (ver EmailIsento.DuracaoDias). Único ponto de verdade: usado no
// login, na checagem de sessão já aberta e na página pública, pra garantir
// que os três se comportam igual.
func (e Estabelecimento) Bloqueado() bool {
	if !e.Ativo {
		return true
	}
	if e.Isento && e.IsentoAte != nil && time.Now().After(*e.IsentoAte) {
		return true
	}
	return false
}
