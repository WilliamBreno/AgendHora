package models

import "time"

type StatusAgendamento string

const (
	// StatusConfirmado é o estado padrão ao criar um agendamento (fluxo self-service,
	// sem aprovação do dono).
	StatusConfirmado StatusAgendamento = "confirmado"
	// StatusCancelado indica que o cliente ou o dono cancelou o agendamento.
	StatusCancelado StatusAgendamento = "cancelado"
	// StatusPendente não é usado no fluxo padrão da v1: fica reservado para o
	// interruptor futuro opcional de aprovação manual em Configurações.
	StatusPendente StatusAgendamento = "pendente"
)

// Agendamento é um horário reservado por um cliente final para um serviço.
type Agendamento struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// ClienteID identifica quem agendou — o Cliente é criado/atualizado
	// automaticamente a partir do nome/telefone/e-mail informados no
	// formulário (ver handlers.encontrarOuCriarCliente), nunca por cadastro
	// manual. default:0 só existe pra migration em cima de linhas
	// existentes (ver database.MigrarClientes, que preenche o valor real
	// em seguida a partir dos dados que já estavam gravados soltos aqui).
	ClienteID uint    `gorm:"not null;default:0;index" json:"cliente_id"`
	Cliente   Cliente `json:"cliente,omitempty"`
	ServicoID uint    `gorm:"not null;index" json:"servico_id"`
	Servico   Servico `json:"servico,omitempty"`
	// ServicosAdicionais são os serviços ALÉM do principal (ServicoID/
	// Servico) escolhidos pro mesmo horário — ver CLAUDE.md "Agendamento com
	// mais de um serviço". Vazio (caso mais comum) = um serviço só,
	// comportamento de sempre. Usar TodosServicos() sempre que precisar
	// considerar o conjunto inteiro (duração, preço) — nunca só `Servico`
	// direto, senão a conta fica incompleta pra um agendamento combo.
	ServicosAdicionais []AgendamentoServico `gorm:"foreignKey:AgendamentoID" json:"servicos_adicionais,omitempty"`
	Data               time.Time            `gorm:"type:date;not null;index" json:"data"`
	// Hora fica no formato "HH:MM" (24h) para evitar problemas de fuso horário.
	Hora        string            `gorm:"not null" json:"hora"`
	Status      StatusAgendamento `gorm:"type:varchar(20);not null;default:confirmado;index" json:"status"`
	Observacoes string            `json:"observacoes"`
	// Pago é marcado manualmente pelo dono/profissional no painel de
	// detalhe — não tem relação com o Status (um agendamento pode estar
	// confirmado e ainda não pago, ex: pagamento na hora do atendimento).
	Pago bool `gorm:"not null;default:false" json:"pago"`
	// Encaixe marca um agendamento criado deliberadamente por cima de outro já
	// existente no mesmo horário — uma decisão manual do dono no painel admin,
	// não o comportamento padrão. A checagem de conflito continua bloqueando
	// por padrão; isso só fica marcado quando ela foi explicitamente ignorada.
	Encaixe bool `gorm:"not null;default:false" json:"encaixe"`
	// LembreteEnviado controla se o lembrete automático por e-mail (ver
	// internal/lembretes) já foi disparado pra esse agendamento — evita
	// reenviar a cada checagem do cron enquanto o horário ainda está dentro
	// da janela de antecedência do lembrete (3h antes).
	LembreteEnviado bool `gorm:"not null;default:false;index" json:"lembrete_enviado"`
	// LembreteFinalEnviado é o segundo lembrete, mais próximo do horário (30
	// min antes) — campo separado de LembreteEnviado porque os dois disparam
	// em janelas diferentes e não podem compartilhar o mesmo controle de
	// duplicidade.
	LembreteFinalEnviado bool `gorm:"not null;default:false;index" json:"lembrete_final_enviado"`
	// ProfissionalID identifica qual profissional (dono ou auxiliar) atende
	// esse agendamento — cada um tem sua própria agenda/disponibilidade.
	// default:0 só existe pra migration em cima de linhas existentes (ver
	// database.MigrarProfissionais, que preenche o valor real em seguida).
	ProfissionalID    uint    `gorm:"not null;default:0;index" json:"profissional_id"`
	Profissional      Usuario `json:"profissional,omitempty"`
	EstabelecimentoID uint    `gorm:"not null;index" json:"estabelecimento_id"`

	// ValorFinal (opcional) sobrescreve o preço do serviço no cálculo de
	// faturamento/dashboard quando preenchido — útil pra qualquer
	// estabelecimento (desconto negociado, serviço com adicional), não só
	// quem usa segmento "tatuagem" (ver CLAUDE.md "Segmentos de negócio").
	// Só editável pelo admin, nunca pelo formulário público.
	ValorFinal *float64 `json:"valor_final"`
	// ValorSinal + SinalPago são o depósito antecipado — mais comum em
	// segmentos como tatuagem, mas disponíveis pra qualquer estabelecimento.
	// Só editáveis pelo admin.
	ValorSinal *float64 `json:"valor_sinal"`
	SinalPago  bool     `gorm:"not null;default:false" json:"sinal_pago"`
	// LinkReferencia é um link de texto simples que o próprio cliente cola
	// no formulário público (ex: imagem de referência hospedada em outro
	// lugar) — não é upload de arquivo nesta v1. O admin também pode
	// editar/completar depois pelo painel de detalhe.
	LinkReferencia string `json:"link_referencia"`

	// ConcluidoEm registra quando o atendimento terminou de verdade (botão
	// "Concluir agora" no painel de detalhe) — nulo até então. Quando
	// preenchido e anterior ao fim oficial (Hora + Servico.DuracaoMin), o
	// motor de disponibilidade do admin considera o resto do horário livre
	// de verdade em vez de esperar o fim oficial (ver CLAUDE.md "Encaixe de
	// horários"). A página pública nunca leva isso em conta — continua
	// sempre conservadora.
	ConcluidoEm *time.Time `json:"concluido_em"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TodosServicos devolve o serviço principal seguido dos adicionais, na
// ordem em que foram escolhidos — usar sempre que duração ou preço
// precisarem considerar TODOS os serviços do agendamento, não só o
// principal (ver CLAUDE.md "Agendamento com mais de um serviço"). Exige
// ServicosAdicionais.Servico pré-carregado; sem isso, cada item adicional
// vem com um Servico zerado.
func (a Agendamento) TodosServicos() []Servico {
	servicos := make([]Servico, 0, 1+len(a.ServicosAdicionais))
	servicos = append(servicos, a.Servico)
	for _, item := range a.ServicosAdicionais {
		servicos = append(servicos, item.Servico)
	}
	return servicos
}

// DuracaoTotalEfetivaMin soma a duração efetiva (ver Servico.DuracaoEfetivaMin)
// de todos os serviços do agendamento — é o que de fato bloqueia a agenda,
// sempre sequencial (um atendimento emendado no outro, sem sobreposição).
func (a Agendamento) DuracaoTotalEfetivaMin() int {
	total := 0
	for _, s := range a.TodosServicos() {
		total += s.DuracaoEfetivaMin()
	}
	return total
}

// PrecoTotal soma o preço de todos os serviços do agendamento — nil se
// QUALQUER um deles não tiver preço cadastrado ("a combinar" pesa mais que
// qualquer soma parcial, pra nunca mostrar um valor que já sabemos que está
// incompleto).
func (a Agendamento) PrecoTotal() *float64 {
	var total float64
	for _, s := range a.TodosServicos() {
		if s.Preco == nil {
			return nil
		}
		total += *s.Preco
	}
	return &total
}
