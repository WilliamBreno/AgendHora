package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

var errEstoqueInsuficiente = errors.New("estoque insuficiente")

type VendaProdutoHandler struct {
	DB *gorm.DB
}

func NewVendaProdutoHandler(db *gorm.DB) *VendaProdutoHandler {
	return &VendaProdutoHandler{DB: db}
}

type vendaProdutoInput struct {
	ProdutoID     uint                      `json:"produto_id" binding:"required"`
	Quantidade    int                       `json:"quantidade" binding:"required,gt=0"`
	TipoComprador models.TipoCompradorVenda `json:"tipo_comprador" binding:"required"`

	// tipo=cliente: ou AgendamentoID (usa o cliente do agendamento — venda
	// junto do serviço), ou ClienteNome+ClienteTelefone (venda avulsa de
	// balcão, casa/cria o Cliente pelo telefone, igual um Agendamento).
	AgendamentoID   *uint  `json:"agendamento_id"`
	ClienteNome     string `json:"cliente_nome"`
	ClienteTelefone string `json:"cliente_telefone"`

	// tipo=profissional: obrigatório — quem está comprando internamente.
	ProfissionalID *uint `json:"profissional_id"`

	// Opcionais — sobrescrevem o cálculo automático quando preenchidos.
	PrecoUnitario      *float64 `json:"preco_unitario"`
	PercentualDesconto *float64 `json:"percentual_desconto"`

	Observacoes string `json:"observacoes"`
}

// Create registra uma venda: valida estoque, calcula preço/desconto e
// desconta do estoque numa transação só — nunca deixa
// Produto.QuantidadeEstoque ficar negativo, mesmo com duas vendas
// concorrentes do mesmo produto (ver condição no UPDATE abaixo).
func (h *VendaProdutoHandler) Create(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	var input vendaProdutoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.TipoComprador != models.CompradorCliente && input.TipoComprador != models.CompradorProfissional {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tipo_comprador inválido"})
		return
	}

	var produto models.Produto
	err := h.DB.Where("id = ? AND estabelecimento_id = ?", input.ProdutoID, estabelecimentoID).First(&produto).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusBadRequest, gin.H{"error": "produto não encontrado"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar produto"})
		return
	}
	if !produto.Ativo {
		c.JSON(http.StatusBadRequest, gin.H{"error": "esse produto está desativado"})
		return
	}
	if produto.QuantidadeEstoque < input.Quantidade {
		c.JSON(http.StatusConflict, gin.H{
			"error": "estoque insuficiente (disponível: " + strconv.Itoa(produto.QuantidadeEstoque) + ")",
		})
		return
	}

	precoUnitario := produto.Preco
	if input.PrecoUnitario != nil {
		if *input.PrecoUnitario < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "preço não pode ser negativo"})
			return
		}
		precoUnitario = *input.PrecoUnitario
	}

	venda := models.VendaProduto{
		ProdutoID:         produto.ID,
		Quantidade:        input.Quantidade,
		PrecoUnitario:     precoUnitario,
		TipoComprador:     input.TipoComprador,
		Observacoes:       strings.TrimSpace(input.Observacoes),
		EstabelecimentoID: estabelecimentoID,
	}

	switch input.TipoComprador {
	case models.CompradorCliente:
		if input.AgendamentoID != nil {
			var agendamento models.Agendamento
			err := h.DB.Where("id = ? AND estabelecimento_id = ?", *input.AgendamentoID, estabelecimentoID).
				First(&agendamento).Error
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"error": "agendamento não encontrado"})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar agendamento"})
				return
			}
			venda.AgendamentoID = input.AgendamentoID
			venda.ClienteID = &agendamento.ClienteID
		} else {
			if strings.TrimSpace(input.ClienteNome) == "" || strings.TrimSpace(input.ClienteTelefone) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "informe o cliente ou um agendamento"})
				return
			}
			cliente, err := encontrarOuCriarCliente(
				h.DB, estabelecimentoID, strings.TrimSpace(input.ClienteNome), strings.TrimSpace(input.ClienteTelefone), "",
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao registrar cliente"})
				return
			}
			venda.ClienteID = &cliente.ID
		}

	case models.CompradorProfissional:
		if input.ProfissionalID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "informe o profissional"})
			return
		}
		var totalProfissional int64
		h.DB.Model(&models.Usuario{}).
			Where("id = ? AND estabelecimento_id = ?", *input.ProfissionalID, estabelecimentoID).
			Count(&totalProfissional)
		if totalProfissional == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "profissional não encontrado"})
			return
		}
		venda.ProfissionalID = input.ProfissionalID

		// desconto: usa o percentual informado na venda; sem isso, cai no
		// padrão configurado em Configurações (nil = sem desconto nenhum).
		var percentual *float64
		if input.PercentualDesconto != nil {
			percentual = input.PercentualDesconto
		} else {
			var estabelecimento models.Estabelecimento
			if err := h.DB.Select("desconto_profissional_percentual").First(&estabelecimento, estabelecimentoID).Error; err == nil {
				percentual = estabelecimento.DescontoProfissionalPercentual
			}
		}
		if percentual != nil {
			if *percentual < 0 || *percentual > 100 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "percentual de desconto precisa estar entre 0 e 100"})
				return
			}
			venda.PercentualDesconto = percentual
			venda.ValorDesconto = precoUnitario * float64(input.Quantidade) * (*percentual) / 100
		}
	}

	valorTotal := precoUnitario*float64(input.Quantidade) - venda.ValorDesconto
	if valorTotal < 0 {
		valorTotal = 0
	}
	venda.ValorTotal = valorTotal

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&venda).Error; err != nil {
			return err
		}
		// condição extra no WHERE: se duas vendas do mesmo produto
		// acontecerem ao mesmo tempo, só a que ainda encontrar estoque
		// suficiente consegue debitar — a outra cai no RowsAffected==0
		// abaixo e devolve erro, em vez de deixar o estoque negativo.
		resultado := tx.Model(&models.Produto{}).
			Where("id = ? AND quantidade_estoque >= ?", produto.ID, input.Quantidade).
			Update("quantidade_estoque", gorm.Expr("quantidade_estoque - ?", input.Quantidade))
		if resultado.Error != nil {
			return resultado.Error
		}
		if resultado.RowsAffected == 0 {
			return errEstoqueInsuficiente
		}
		return nil
	})
	if errors.Is(err, errEstoqueInsuficiente) {
		c.JSON(http.StatusConflict, gin.H{"error": "estoque insuficiente"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao registrar venda"})
		return
	}

	h.DB.Preload("Produto").Preload("Cliente").Preload("Profissional").First(&venda, venda.ID)
	c.JSON(http.StatusCreated, venda)
}

// List retorna as vendas do estabelecimento, mais recentes primeiro.
// inicio/fim (opcionais) filtram por data de criação, mesmo vocabulário do
// resto do admin; tipo_comprador filtra cliente vs profissional.
func (h *VendaProdutoHandler) List(c *gin.Context) {
	query := h.DB.Preload("Produto").Preload("Cliente").Preload("Profissional").
		Where("estabelecimento_id = ?", auth.EstabelecimentoID(c))

	if inicioStr := c.Query("inicio"); inicioStr != "" {
		inicio, err := time.Parse("2006-01-02", inicioStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'inicio' inválido"})
			return
		}
		query = query.Where("created_at >= ?", inicio)
	}
	if fimStr := c.Query("fim"); fimStr != "" {
		fim, err := time.Parse("2006-01-02", fimStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'fim' inválido"})
			return
		}
		query = query.Where("created_at < ?", fim.AddDate(0, 0, 1))
	}
	if tipo := c.Query("tipo_comprador"); tipo != "" {
		query = query.Where("tipo_comprador = ?", tipo)
	}
	if agendamentoIDStr := c.Query("agendamento_id"); agendamentoIDStr != "" {
		query = query.Where("agendamento_id = ?", agendamentoIDStr)
	}

	var vendas []models.VendaProduto
	if err := query.Order("created_at desc").Find(&vendas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar vendas"})
		return
	}
	c.JSON(http.StatusOK, vendas)
}

func (h *VendaProdutoHandler) buscarVenda(c *gin.Context) (*models.VendaProduto, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return nil, false
	}
	var venda models.VendaProduto
	err = h.DB.Preload("Produto").Preload("Cliente").Preload("Profissional").
		Where("id = ? AND estabelecimento_id = ?", id, auth.EstabelecimentoID(c)).
		First(&venda).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "venda não encontrada"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar venda"})
		return nil, false
	}
	return &venda, true
}

type atualizarPagoVendaInput struct {
	Pago bool `json:"pago"`
}

func (h *VendaProdutoHandler) AtualizarPago(c *gin.Context) {
	venda, ok := h.buscarVenda(c)
	if !ok {
		return
	}
	var input atualizarPagoVendaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.DB.Model(venda).Update("pago", input.Pago).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar pagamento"})
		return
	}
	venda.Pago = input.Pago
	c.JSON(http.StatusOK, venda)
}

// Cancelar desfaz uma venda registrada por engano: devolve a quantidade pro
// estoque do produto e marca a venda como cancelada (não conta mais no
// financeiro, mas continua no histórico pra auditoria).
func (h *VendaProdutoHandler) Cancelar(c *gin.Context) {
	venda, ok := h.buscarVenda(c)
	if !ok {
		return
	}
	if venda.Cancelada {
		c.JSON(http.StatusOK, venda)
		return
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(venda).Update("cancelada", true).Error; err != nil {
			return err
		}
		return tx.Model(&models.Produto{}).Where("id = ?", venda.ProdutoID).
			Update("quantidade_estoque", gorm.Expr("quantidade_estoque + ?", venda.Quantidade)).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao cancelar venda"})
		return
	}
	venda.Cancelada = true
	c.JSON(http.StatusOK, venda)
}
