package models

import "time"

// Produto é um item físico vendido pelo estabelecimento (ex: shampoo,
// tinta, agulha de tatuagem) — separado de Servico, que é trabalho, não
// mercadoria. Ver CLAUDE.md "Cadastro de produtos".
type Produto struct {
	ID    uint    `gorm:"primaryKey" json:"id"`
	Nome  string  `gorm:"not null" json:"nome"`
	Preco float64 `gorm:"not null" json:"preco"`
	// CustoUnitario é opcional — só quando preenchido o financeiro consegue
	// mostrar lucro (preço - custo) em vez de só faturamento (receita) da
	// venda desse produto.
	CustoUnitario *float64 `json:"custo_unitario"`
	// QuantidadeEstoque é descontado automaticamente a cada venda
	// registrada (ver VendaProduto) — uma venda nunca é aceita se deixaria
	// o estoque negativo.
	QuantidadeEstoque int `gorm:"not null;default:0" json:"quantidade_estoque"`
	// EstoqueMinimo dispara a sinalização automática de "estoque baixo" na
	// tela de Produtos — mesmo padrão de "aparece sozinho, sem precisar
	// checar" já usado em Clientes sumidos. 0 desliga o aviso pra esse
	// produto (não incomoda quem não quer configurar).
	EstoqueMinimo int `gorm:"not null;default:0" json:"estoque_minimo"`
	// Ativo desliga o produto da venda (ex: descontinuado) sem apagar o
	// cadastro nem quebrar o histórico de vendas antigas, que continuam
	// referenciando ele normalmente.
	Ativo             bool   `gorm:"not null;default:true" json:"ativo"`
	Descricao         string `json:"descricao"`
	Foto              string `json:"foto"`
	EstabelecimentoID uint   `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
