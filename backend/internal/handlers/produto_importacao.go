package handlers

import (
	"bytes"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ledongthuc/pdf"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

// produtoImportado é uma linha lida do arquivo (PDF ou XLSX) — nunca é
// salva direto no banco: primeiro volta como prévia editável (ver
// ImportarPreview), o dono confirma/corrige, e só então
// ImportarConfirmar cria os produtos de verdade. Preço zerado é comum em
// leitura de PDF malformatada — fica visível na prévia pra corrigir, em vez
// de silenciosamente virar um produto de graça.
type produtoImportado struct {
	Nome  string  `json:"nome"`
	Preco float64 `json:"preco"`
}

// ImportarPreview lê um arquivo .pdf ou .xlsx (multipart, campo "arquivo")
// e devolve os produtos encontrados — nome + preço — sem salvar nada ainda.
// PDF é leitura heurística (baseada em padrão de texto "nome ... valor" por
// linha) e pode errar em layouts fora do comum; XLSX é mais confiável
// (colunas explícitas). Os dois casos existem justamente pra dar chance de
// revisar/corrigir antes de qualquer produto ser criado (ver
// ImportarConfirmar).
func (h *ProdutoHandler) ImportarPreview(c *gin.Context) {
	arquivo, header, err := c.Request.FormFile("arquivo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "envie um arquivo .pdf ou .xlsx"})
		return
	}
	defer arquivo.Close()

	var itens []produtoImportado
	switch strings.ToLower(filepath.Ext(header.Filename)) {
	case ".xlsx":
		itens, err = parseXLSXProdutos(arquivo)
	case ".pdf":
		itens, err = parsePDFProdutos(arquivo)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "formato não suportado — envie um arquivo .pdf ou .xlsx"})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "não consegui ler o arquivo: " + err.Error()})
		return
	}
	if len(itens) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "nenhum produto reconhecido nesse arquivo — confira o formato ou cadastre manualmente",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"itens": itens})
}

type importarConfirmarInput struct {
	Itens []produtoImportado `json:"itens" binding:"required,min=1"`
}

// ImportarConfirmar recebe a lista já revisada pelo dono (ver
// ImportarPreview) e cria/atualiza os produtos de verdade — casa por nome
// (sem diferenciar maiúsculas/acentos de espaçamento) dentro do
// estabelecimento: já existe, só atualiza o preço; não existe, cria com
// estoque zerado (o dono ajusta a quantidade depois, se vender com
// controle de estoque). Mesmo padrão de retorno da importação de clientes
// (criados/atualizados/total).
func (h *ProdutoHandler) ImportarConfirmar(c *gin.Context) {
	var input importarConfirmarInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	estabelecimentoID := auth.EstabelecimentoID(c)
	var criados, atualizados int
	for _, item := range input.Itens {
		nome := strings.TrimSpace(item.Nome)
		if nome == "" || item.Preco <= 0 {
			continue
		}

		var produto models.Produto
		err := h.DB.Where(
			"estabelecimento_id = ? AND lower(nome) = lower(?)", estabelecimentoID, nome,
		).First(&produto).Error
		if err == gorm.ErrRecordNotFound {
			produto = models.Produto{
				Nome:              nome,
				Preco:             item.Preco,
				Ativo:             true,
				EstabelecimentoID: estabelecimentoID,
			}
			if err := h.DB.Create(&produto).Error; err == nil {
				criados++
			}
			continue
		}
		if err != nil {
			continue
		}

		produto.Preco = item.Preco
		if err := h.DB.Save(&produto).Error; err == nil {
			atualizados++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"criados":     criados,
		"atualizados": atualizados,
		"total":       len(input.Itens),
	})
}

// normalizarCabecalhoPlanilha compara nomes de coluna ignorando
// maiúsculas/acentos/espaço — mesma ideia de normalizarCabecalhoCSV (ver
// cliente_importacao.go), duplicada aqui de propósito: são formatos
// diferentes (XLSX vs CSV), não vale a pena acoplar os dois só pra
// reaproveitar uma função de 3 linhas.
var substituirAcentosPlanilha = strings.NewReplacer(
	"á", "a", "à", "a", "ã", "a", "â", "a",
	"é", "e", "ê", "e",
	"í", "i",
	"ó", "o", "õ", "o", "ô", "o",
	"ú", "u", "ç", "c",
)

func normalizarCabecalhoPlanilha(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "_", "")
	return substituirAcentosPlanilha.Replace(s)
}

// parseXLSXProdutos lê a primeira planilha do arquivo. Quando a primeira
// linha tem um cabeçalho reconhecível (Nome/Produto e Preço/Valor), usa as
// colunas certas e pula essa linha; sem cabeçalho reconhecido, assume
// coluna A = nome e B = preço, sem pular nenhuma linha.
func parseXLSXProdutos(r io.Reader) ([]produtoImportado, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	linhas, err := f.GetRows(sheet)
	if err != nil {
		return nil, err
	}
	if len(linhas) == 0 {
		return nil, nil
	}

	idxNome, idxPreco := 0, 1
	inicio := 0
	achouCabecalho := false
	for i, coluna := range linhas[0] {
		switch normalizarCabecalhoPlanilha(coluna) {
		case "nome", "produto", "descricao", "item":
			idxNome, achouCabecalho = i, true
		case "preco", "valor", "precovenda", "valorunitario", "valorunit":
			idxPreco, achouCabecalho = i, true
		}
	}
	if achouCabecalho {
		inicio = 1
	}

	itens := make([]produtoImportado, 0, len(linhas))
	for _, linha := range linhas[inicio:] {
		if idxNome >= len(linha) {
			continue
		}
		nome := strings.TrimSpace(linha[idxNome])
		if nome == "" {
			continue
		}
		var preco float64
		if idxPreco < len(linha) {
			preco = parsePrecoFlexivel(linha[idxPreco])
		}
		itens = append(itens, produtoImportado{Nome: nome, Preco: preco})
	}
	return itens, nil
}

// regexPrecoLinha acha um valor em reais no final de uma linha de texto —
// "R$ 1.234,56", "1.234,56" ou "12,90" — o formato mais comum em listas de
// preço simples (nome do produto seguido do valor).
var regexPrecoLinha = regexp.MustCompile(`(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*$`)

// parsePDFProdutos extrai o texto puro do PDF (só funciona em PDF com texto
// selecionável, não em imagem escaneada) e tenta reconhecer, linha a linha,
// o padrão "nome do produto ... valor" — puramente heurístico, por isso
// ImportarPreview sempre mostra o resultado pra revisão antes de salvar.
func parsePDFProdutos(r io.Reader) ([]produtoImportado, error) {
	conteudo, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	leitor, err := pdf.NewReader(bytes.NewReader(conteudo), int64(len(conteudo)))
	if err != nil {
		return nil, err
	}
	textoReader, err := leitor.GetPlainText()
	if err != nil {
		return nil, err
	}
	texto, err := io.ReadAll(textoReader)
	if err != nil {
		return nil, err
	}

	var itens []produtoImportado
	for _, linhaBruta := range strings.Split(string(texto), "\n") {
		linha := strings.TrimSpace(linhaBruta)
		if linha == "" {
			continue
		}
		posicoes := regexPrecoLinha.FindStringSubmatchIndex(linha)
		if posicoes == nil {
			continue
		}
		precoStr := linha[posicoes[2]:posicoes[3]]
		nome := strings.TrimSpace(linha[:posicoes[0]])
		nome = strings.Trim(nome, ".·-—_ \t")
		if nome == "" {
			continue
		}
		preco := parsePrecoFlexivel(precoStr)
		if preco <= 0 {
			continue
		}
		itens = append(itens, produtoImportado{Nome: nome, Preco: preco})
	}
	return itens, nil
}

// parsePrecoFlexivel aceita "R$ 1.234,56" (formato BR, o mais comum),
// "1234.56" (ponto decimal) e variações com/sem símbolo de moeda — texto
// não reconhecível vira 0 (fica visível na prévia pra corrigir na mão, em
// vez de falhar a importação inteira por causa de uma linha ruim).
func parsePrecoFlexivel(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.NewReplacer("R$", "", "r$", "", " ", "").Replace(s)
	if s == "" {
		return 0
	}
	if strings.Contains(s, ",") {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	}
	valor, err := strconv.ParseFloat(s, 64)
	if err != nil || valor < 0 {
		return 0
	}
	return valor
}
