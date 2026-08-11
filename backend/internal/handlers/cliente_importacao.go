package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type registroImportado struct {
	Nome           string
	Telefone       string
	DataNascimento *time.Time
}

// Importar aceita um arquivo .csv ou .vcf (multipart, campo "arquivo") e
// cadastra/atualiza clientes em lote — casa por telefone dentro do
// estabelecimento, igual ao fluxo automático de agendamento (ver
// encontrarOuCriarCliente), só que aqui em massa. .vcf é o formato de
// exportação de contatos nativo do celular (Android e iPhone, ao contrário
// da API de Contact Picker do navegador, que só funciona no Chrome/Android).
func (h *ClienteHandler) Importar(c *gin.Context) {
	arquivo, header, err := c.Request.FormFile("arquivo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "envie um arquivo .csv ou .vcf"})
		return
	}
	defer arquivo.Close()

	var registros []registroImportado
	switch strings.ToLower(filepath.Ext(header.Filename)) {
	case ".csv":
		registros, err = parseCSVClientes(arquivo)
	case ".vcf":
		registros, err = parseVCFClientes(arquivo)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "formato não suportado — envie um arquivo .csv ou .vcf"})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "não consegui ler o arquivo: " + err.Error()})
		return
	}
	if len(registros) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nenhum contato válido encontrado no arquivo"})
		return
	}

	estabelecimentoID := auth.EstabelecimentoID(c)
	var criados, atualizados int
	for _, r := range registros {
		telefoneNormalizado := apenasDigitos(r.Telefone)
		if telefoneNormalizado == "" || r.Nome == "" {
			continue
		}

		var cliente models.Cliente
		err := h.DB.Where(
			"estabelecimento_id = ? AND regexp_replace(telefone, '[^0-9]', '', 'g') = ?",
			estabelecimentoID, telefoneNormalizado,
		).First(&cliente).Error
		if err == gorm.ErrRecordNotFound {
			cliente = models.Cliente{
				Nome:              r.Nome,
				Telefone:          r.Telefone,
				DataNascimento:    r.DataNascimento,
				EstabelecimentoID: estabelecimentoID,
			}
			if err := h.DB.Create(&cliente).Error; err == nil {
				criados++
			}
			continue
		}
		if err != nil {
			continue
		}

		cliente.Nome = r.Nome
		if r.DataNascimento != nil {
			cliente.DataNascimento = r.DataNascimento
		}
		if err := h.DB.Save(&cliente).Error; err == nil {
			atualizados++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"criados":     criados,
		"atualizados": atualizados,
		"total":       len(registros),
	})
}

// parseCSVClientes espera uma linha de cabeçalho com colunas reconhecíveis
// (Nome, Telefone, e opcionalmente Data de Nascimento) — a ordem não
// importa, e aceita ";" ou "," como separador (";" é o padrão de CSV
// exportado por Excel/Sheets em pt-BR).
func parseCSVClientes(r io.Reader) ([]registroImportado, error) {
	conteudo, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	texto := string(conteudo)

	primeiraLinha := texto
	if i := strings.IndexAny(texto, "\r\n"); i != -1 {
		primeiraLinha = texto[:i]
	}
	delimitador := ','
	if strings.Count(primeiraLinha, ";") > strings.Count(primeiraLinha, ",") {
		delimitador = ';'
	}

	leitor := csv.NewReader(strings.NewReader(texto))
	leitor.Comma = delimitador
	leitor.FieldsPerRecord = -1
	leitor.TrimLeadingSpace = true
	linhas, err := leitor.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(linhas) < 1 {
		return nil, fmt.Errorf("arquivo vazio")
	}

	idxNome, idxTelefone, idxNascimento := -1, -1, -1
	for i, coluna := range linhas[0] {
		switch normalizarCabecalhoCSV(coluna) {
		case "nome", "name":
			idxNome = i
		case "telefone", "celular", "fone", "phone":
			idxTelefone = i
		case "datanascimento", "nascimento", "aniversario", "birthday", "datadenascimento":
			idxNascimento = i
		}
	}
	if idxNome == -1 || idxTelefone == -1 {
		return nil, fmt.Errorf("o CSV precisa ter pelo menos as colunas Nome e Telefone")
	}

	registros := make([]registroImportado, 0, len(linhas)-1)
	for _, linha := range linhas[1:] {
		if idxNome >= len(linha) || idxTelefone >= len(linha) {
			continue
		}
		nome := strings.TrimSpace(linha[idxNome])
		telefone := strings.TrimSpace(linha[idxTelefone])
		if nome == "" || telefone == "" {
			continue
		}
		var nascimento *time.Time
		if idxNascimento != -1 && idxNascimento < len(linha) {
			nascimento = parseDataFlexivel(linha[idxNascimento])
		}
		registros = append(registros, registroImportado{Nome: nome, Telefone: telefone, DataNascimento: nascimento})
	}
	return registros, nil
}

var substituirAcentosCSV = strings.NewReplacer(
	"á", "a", "à", "a", "ã", "a", "â", "a",
	"é", "e", "ê", "e",
	"í", "i",
	"ó", "o", "õ", "o", "ô", "o",
	"ú", "u", "ç", "c",
)

func normalizarCabecalhoCSV(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "_", "")
	return substituirAcentosCSV.Replace(s)
}

func parseDataFlexivel(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	for _, formato := range []string{"02/01/2006", "2006-01-02", "02-01-2006"} {
		if t, err := time.Parse(formato, s); err == nil {
			return &t
		}
	}
	return nil
}

// parseVCFClientes lê um arquivo vCard (RFC 6350) — o formato que Android e
// iPhone geram ao exportar/compartilhar contatos. Aceita várias entradas
// BEGIN:VCARD...END:VCARD no mesmo arquivo (exportação em lote).
func parseVCFClientes(r io.Reader) ([]registroImportado, error) {
	conteudo, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	texto := strings.ReplaceAll(string(conteudo), "\r\n", "\n")
	brutas := strings.Split(texto, "\n")

	// desdobra linhas continuadas (começam com espaço/tab) — parte do
	// formato vCard pra linhas de valor muito longas.
	linhas := make([]string, 0, len(brutas))
	for _, l := range brutas {
		if (strings.HasPrefix(l, " ") || strings.HasPrefix(l, "\t")) && len(linhas) > 0 {
			linhas[len(linhas)-1] += l[1:]
		} else {
			linhas = append(linhas, l)
		}
	}

	var registros []registroImportado
	var fn, n, tel, bday string
	dentroVCard := false

	finalizar := func() {
		if !dentroVCard {
			return
		}
		nome := strings.TrimSpace(fn)
		if nome == "" && n != "" {
			partes := strings.Split(n, ";")
			if len(partes) >= 2 {
				nome = strings.TrimSpace(partes[1] + " " + partes[0])
			} else {
				nome = strings.TrimSpace(n)
			}
		}
		if nome != "" && tel != "" {
			registros = append(registros, registroImportado{
				Nome:           nome,
				Telefone:       tel,
				DataNascimento: parseDataBday(bday),
			})
		}
		fn, n, tel, bday = "", "", "", ""
	}

	for _, linhaBruta := range linhas {
		linha := strings.TrimSpace(linhaBruta)
		if strings.EqualFold(linha, "BEGIN:VCARD") {
			dentroVCard = true
			fn, n, tel, bday = "", "", "", ""
			continue
		}
		if strings.EqualFold(linha, "END:VCARD") {
			finalizar()
			dentroVCard = false
			continue
		}
		if !dentroVCard || linha == "" {
			continue
		}
		idx := strings.Index(linha, ":")
		if idx == -1 {
			continue
		}
		propriedade := strings.ToUpper(strings.SplitN(linha[:idx], ";", 2)[0])
		valor := linha[idx+1:]
		switch propriedade {
		case "FN":
			fn = valor
		case "N":
			n = valor
		case "TEL":
			if tel == "" {
				tel = valor
			}
		case "BDAY":
			if bday == "" {
				bday = valor
			}
		}
	}
	return registros, nil
}

func parseDataBday(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	for _, formato := range []string{"20060102", "2006-01-02"} {
		if t, err := time.Parse(formato, s); err == nil {
			return &t
		}
	}
	return nil
}
