package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type ProdutoHandler struct {
	DB *gorm.DB
}

func NewProdutoHandler(db *gorm.DB) *ProdutoHandler {
	return &ProdutoHandler{DB: db}
}

type produtoInput struct {
	Nome              string   `json:"nome" binding:"required"`
	Preco             float64  `json:"preco" binding:"required,gt=0"`
	CustoUnitario     *float64 `json:"custo_unitario"`
	QuantidadeEstoque int      `json:"quantidade_estoque"`
	EstoqueMinimo     int      `json:"estoque_minimo"`
	Ativo             *bool    `json:"ativo"`
	Descricao         string   `json:"descricao"`
	Foto              string   `json:"foto"`
}

func validarProdutoInput(input produtoInput) string {
	if input.CustoUnitario != nil && *input.CustoUnitario < 0 {
		return "custo não pode ser negativo"
	}
	if input.QuantidadeEstoque < 0 {
		return "quantidade em estoque não pode ser negativa"
	}
	if input.EstoqueMinimo < 0 {
		return "estoque mínimo não pode ser negativo"
	}
	return ""
}

// List retorna os produtos do estabelecimento — inclui os inativos
// (descontinuados), o frontend decide como exibir cada um.
func (h *ProdutoHandler) List(c *gin.Context) {
	var produtos []models.Produto
	err := h.DB.Where("estabelecimento_id = ?", auth.EstabelecimentoID(c)).
		Order("nome asc").
		Find(&produtos).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar produtos"})
		return
	}
	c.JSON(http.StatusOK, produtos)
}

func (h *ProdutoHandler) Create(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	var input produtoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if msg := validarProdutoInput(input); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	if !validarImagemBase64(c, input.Foto) {
		return
	}

	produto := models.Produto{
		Nome:              strings.TrimSpace(input.Nome),
		Preco:             input.Preco,
		CustoUnitario:     input.CustoUnitario,
		QuantidadeEstoque: input.QuantidadeEstoque,
		EstoqueMinimo:     input.EstoqueMinimo,
		Ativo:             true,
		Descricao:         strings.TrimSpace(input.Descricao),
		Foto:              input.Foto,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&produto).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar produto"})
		return
	}
	c.JSON(http.StatusCreated, produto)
}

func (h *ProdutoHandler) buscarProduto(c *gin.Context) (*models.Produto, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return nil, false
	}

	var produto models.Produto
	err = h.DB.Where("id = ? AND estabelecimento_id = ?", id, auth.EstabelecimentoID(c)).First(&produto).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "produto não encontrado"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar produto"})
		return nil, false
	}
	return &produto, true
}

func (h *ProdutoHandler) Get(c *gin.Context) {
	produto, ok := h.buscarProduto(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, produto)
}

func (h *ProdutoHandler) Update(c *gin.Context) {
	produto, ok := h.buscarProduto(c)
	if !ok {
		return
	}

	var input produtoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if msg := validarProdutoInput(input); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	if !validarImagemBase64(c, input.Foto) {
		return
	}

	produto.Nome = strings.TrimSpace(input.Nome)
	produto.Preco = input.Preco
	produto.CustoUnitario = input.CustoUnitario
	produto.QuantidadeEstoque = input.QuantidadeEstoque
	produto.EstoqueMinimo = input.EstoqueMinimo
	if input.Ativo != nil {
		produto.Ativo = *input.Ativo
	}
	produto.Descricao = strings.TrimSpace(input.Descricao)
	produto.Foto = input.Foto

	if err := h.DB.Save(produto).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar produto"})
		return
	}
	c.JSON(http.StatusOK, produto)
}

// Delete só é permitido quando o produto nunca foi vendido — caso contrário
// o dono deve desativar (Ativo=false) em vez de apagar, pra não perder o
// histórico de vendas antigas que referenciam esse produto.
func (h *ProdutoHandler) Delete(c *gin.Context) {
	produto, ok := h.buscarProduto(c)
	if !ok {
		return
	}

	var totalVendas int64
	h.DB.Model(&models.VendaProduto{}).Where("produto_id = ?", produto.ID).Count(&totalVendas)
	if totalVendas > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": "esse produto já tem vendas registradas — desative em vez de excluir, pra não perder o histórico",
		})
		return
	}

	if err := h.DB.Delete(produto).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao excluir produto"})
		return
	}
	c.Status(http.StatusNoContent)
}
