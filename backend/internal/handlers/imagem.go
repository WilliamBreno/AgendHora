package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// tamanhoMaximoImagem é ~2MB em base64 (~1.5MB de imagem original) — usado
// tanto pra logo do estabelecimento quanto pra foto de exemplo do serviço.
const tamanhoMaximoImagem = 2 * 1024 * 1024

// validarImagemBase64 confere se uma data URI de imagem está dentro do
// tamanho aceito e tem o formato esperado. String vazia é válida (significa
// "sem imagem"). Já escreve a resposta de erro em caso de falha.
func validarImagemBase64(c *gin.Context, dataURI string) bool {
	if dataURI == "" {
		return true
	}
	if len(dataURI) > tamanhoMaximoImagem {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imagem muito grande (máximo ~1.5MB)"})
		return false
	}
	if !strings.HasPrefix(dataURI, "data:image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "formato de imagem inválido"})
		return false
	}
	return true
}
