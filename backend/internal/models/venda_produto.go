package models

import "time"

// TipoCompradorVenda distingue a venda pro cliente final da compra interna
// de um profissional (dono ou auxiliar) — ver CLAUDE.md "Cadastro de
// produtos". O desconto automático só se aplica ao tipo "profissional".
type TipoCompradorVenda string

const (
	CompradorCliente      TipoCompradorVenda = "cliente"
	CompradorProfissional TipoCompradorVenda = "profissional"
)

// VendaProduto registra a saída de um produto do estoque — pro cliente
// final (avulsa ou junto de um Agendamento) ou pra compra interna de um
// profissional (com desconto opcional). Cada venda desconta
// Produto.QuantidadeEstoque na hora de ser criada.
type VendaProduto struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	ProdutoID  uint    `gorm:"not null;index" json:"produto_id"`
	Produto    Produto `json:"produto,omitempty"`
	Quantidade int     `gorm:"not null" json:"quantidade"`
	// PrecoUnitario e ValorTotal ficam congelados no momento da venda — se o
	// preço do produto mudar depois, o histórico de vendas antigas não muda
	// junto.
	PrecoUnitario float64            `gorm:"not null" json:"preco_unitario"`
	ValorTotal    float64            `gorm:"not null" json:"valor_total"`
	TipoComprador TipoCompradorVenda `gorm:"type:varchar(20);not null" json:"tipo_comprador"`

	// ClienteID só é preenchido quando TipoComprador = cliente. Segue o
	// mesmo padrão de Agendamento: casa/cria o Cliente pelo telefone (ver
	// handlers.encontrarOuCriarCliente).
	ClienteID *uint   `json:"cliente_id"`
	Cliente   Cliente `json:"cliente,omitempty"`
	// AgendamentoID é opcional — vincula a venda a um agendamento existente
	// (cliente levou o produto junto do serviço). Vendas de balcão, sem
	// nenhum serviço envolvido, ficam com isso nulo.
	AgendamentoID *uint `json:"agendamento_id"`
	// ProfissionalID só é preenchido quando TipoComprador = profissional —
	// referencia Usuario (dono ou auxiliar), igual Agendamento.ProfissionalID.
	ProfissionalID *uint   `json:"profissional_id"`
	Profissional   Usuario `json:"profissional,omitempty"`

	// PercentualDesconto e ValorDesconto ficam registrados na própria venda
	// mesmo que a configuração global de desconto (ver
	// Estabelecimento.DescontoProfissionalPercentual) mude depois — o
	// histórico não se altera retroativamente.
	PercentualDesconto *float64 `json:"percentual_desconto"`
	ValorDesconto      float64  `gorm:"not null;default:0" json:"valor_desconto"`

	Pago      bool `gorm:"not null;default:false" json:"pago"`
	Cancelada bool `gorm:"not null;default:false" json:"cancelada"`

	Observacoes       string `json:"observacoes"`
	EstabelecimentoID uint   `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
