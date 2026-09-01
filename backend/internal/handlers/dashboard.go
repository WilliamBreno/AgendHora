package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

func formatarReais(valor float64) string {
	return "R$ " + strings.Replace(fmt.Sprintf("%.2f", valor), ".", ",", 1)
}

// valorAgendamento é o valor de faturamento de um agendamento: usa
// ValorFinal quando preenchido, senão a soma do preço de TODOS os serviços
// do agendamento (ver Agendamento.PrecoTotal — um só, no caso mais comum)
// — vale pra qualquer estabelecimento, não é exclusivo de nenhum segmento
// (ver CLAUDE.md "Segmentos de negócio"). Sem nenhum dos dois (algum
// serviço "a combinar" ainda não fechado), conta como 0 no faturamento.
func valorAgendamento(a models.Agendamento) float64 {
	if a.ValorFinal != nil {
		return *a.ValorFinal
	}
	if preco := a.PrecoTotal(); preco != nil {
		return *preco
	}
	return 0
}

// ResumoSemana soma o faturamento e conta os agendamentos confirmados de um
// estabelecimento no intervalo [inicio, fim] — usado pelo resumo semanal por
// e-mail (ver internal/resumosemanal), reaproveitando a mesma regra de
// valorAgendamento usada no resto do dashboard, em vez de duplicá-la lá.
func ResumoSemana(db *gorm.DB, estabelecimentoID uint, inicio, fim time.Time) (faturamento float64, quantidade int, err error) {
	var agendamentos []models.Agendamento
	err = db.Preload("Servico").Preload("ServicosAdicionais.Servico").
		Where(
			"estabelecimento_id = ? AND status = ? AND data >= ? AND data <= ?",
			estabelecimentoID, models.StatusConfirmado, inicio, fim,
		).
		Find(&agendamentos).Error
	if err != nil {
		return 0, 0, err
	}
	for _, a := range agendamentos {
		faturamento += valorAgendamento(a)
	}
	return faturamento, len(agendamentos), nil
}

// SugestaoPrincipal calcula a mesma sugestão que apareceria no topo do
// dashboard nesse exato momento pro estabelecimento — usada pelo resumo
// semanal por e-mail, que reaproveita o motor de sugestões em vez de
// duplicar a lógica (ver CLAUDE.md "Motor de sugestões de faturamento").
func SugestaoPrincipal(db *gorm.DB, estabelecimentoID uint) (titulo, descricao string, ok bool) {
	agora := time.Now()
	hoje := time.Date(agora.Year(), agora.Month(), agora.Day(), 0, 0, 0, 0, time.UTC)
	fimMes := time.Date(hoje.Year(), hoje.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 1, -1)
	inicioJanela := hoje.AddDate(0, 0, -60)

	var agendamentos []models.Agendamento
	err := db.Preload("Servico").Preload("ServicosAdicionais.Servico").
		Where(
			"estabelecimento_id = ? AND status = ? AND data >= ? AND data <= ?",
			estabelecimentoID, models.StatusConfirmado, inicioJanela, fimMes,
		).
		Order("data asc").Find(&agendamentos).Error
	if err != nil {
		return "", "", false
	}

	var estabelecimento models.Estabelecimento
	if err := db.First(&estabelecimento, estabelecimentoID).Error; err != nil {
		return "", "", false
	}
	var horarios models.HorarioFuncionamento
	if err := json.Unmarshal(estabelecimento.HorarioFuncionamento, &horarios); err != nil {
		horarios = models.HorarioFuncionamento{}
	}

	sugestoes := gerarSugestoes(agendamentos, horarios, hoje, agora)
	if len(sugestoes) == 0 {
		return "", "", false
	}
	return sugestoes[0].Titulo, sugestoes[0].Descricao, true
}

// aplicarFiltroProfissional restringe a query por profissional — um
// auxiliar sempre só vê a própria agenda; o dono vê tudo por padrão e pode
// filtrar por um ou mais profissional_id (multi-seleção, ver CLAUDE.md
// "Multi-seleção de profissional"), repetindo o parâmetro na query string
// (ex: ?profissional_id=1&profissional_id=2).
func aplicarFiltroProfissional(c *gin.Context, query *gorm.DB) *gorm.DB {
	if auth.Papel(c) == models.PapelAuxiliar {
		return query.Where("profissional_id = ?", auth.UsuarioID(c))
	}
	if profissionalIDs := c.QueryArray("profissional_id"); len(profissionalIDs) > 0 {
		return query.Where("profissional_id IN ?", profissionalIDs)
	}
	return query
}

type DashboardHandler struct {
	DB *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{DB: db}
}

type periodoMetricas struct {
	Agendamentos int     `json:"agendamentos"`
	Faturamento  float64 `json:"faturamento"`
	// Recebido/AReceber separam o faturamento do período usando o campo
	// Pago de cada agendamento — a soma dos dois sempre bate com Faturamento.
	Recebido          float64 `json:"recebido"`
	AReceber          float64 `json:"a_receber"`
	AindaVaoAcontecer int     `json:"ainda_vao_acontecer"`
}

type pontoGrafico struct {
	Data  string  `json:"data"`
	Valor float64 `json:"valor"`
}

type rankingItem struct {
	ServicoID   uint    `json:"servico_id"`
	Nome        string  `json:"nome"`
	Cor         string  `json:"cor"`
	Quantidade  int     `json:"quantidade"`
	Faturamento float64 `json:"faturamento"`
}

type sugestao struct {
	Tipo      string `json:"tipo"` // "alerta" | "incentivo"
	Titulo    string `json:"titulo"`
	Descricao string `json:"descricao"`
}

type dashboardResponse struct {
	Hoje               periodoMetricas `json:"hoje"`
	Semana             periodoMetricas `json:"semana"`
	Mes                periodoMetricas `json:"mes"`
	Grafico7Dias       []pontoGrafico  `json:"grafico_7_dias"`
	Grafico30Dias      []pontoGrafico  `json:"grafico_30_dias"`
	RankingQuantidade  []rankingItem   `json:"ranking_quantidade"`
	RankingFaturamento []rankingItem   `json:"ranking_faturamento"`
	Sugestoes          []sugestao      `json:"sugestoes"`

	// Produtos* considera só vendas pro cliente final (tipo_comprador =
	// cliente) — compra interna de profissional é controle de estoque, não
	// faturamento de verdade do negócio (ver CLAUDE.md "Cadastro de
	// produtos"). Só o dono vê esses números: não dá pra atribuir uma venda
	// de produto a um profissional específico hoje, então um auxiliar
	// sempre recebe isso zerado.
	ProdutosHoje         produtosMetricas     `json:"produtos_hoje"`
	ProdutosSemana       produtosMetricas     `json:"produtos_semana"`
	ProdutosMes          produtosMetricas     `json:"produtos_mes"`
	ProdutosMaisVendidos []produtoRankingItem `json:"produtos_mais_vendidos"`
}

type produtosMetricas struct {
	Quantidade  int     `json:"quantidade"`
	Faturamento float64 `json:"faturamento"`
	// Lucro só soma a parte de vendas cujo produto tem CustoUnitario
	// cadastrado — sem custo, aquela venda entra no faturamento normalmente
	// mas não contribui pro lucro (não tem como calcular).
	Lucro float64 `json:"lucro"`
}

type produtoRankingItem struct {
	ProdutoID   uint    `json:"produto_id"`
	Nome        string  `json:"nome"`
	Quantidade  int     `json:"quantidade"`
	Faturamento float64 `json:"faturamento"`
}

// metricasProdutos soma quantidade/faturamento/lucro das vendas (já
// filtradas por tipo_comprador=cliente e não-canceladas) cuja data cai
// dentro de [inicio, fim] — mesmo padrão de metricasPeriodo, mas pra
// VendaProduto em vez de Agendamento.
func metricasProdutos(vendas []models.VendaProduto, inicio, fim time.Time) produtosMetricas {
	m := produtosMetricas{}
	for _, v := range vendas {
		dia := time.Date(v.CreatedAt.Year(), v.CreatedAt.Month(), v.CreatedAt.Day(), 0, 0, 0, 0, time.UTC)
		if dia.Before(inicio) || dia.After(fim) {
			continue
		}
		m.Quantidade += v.Quantidade
		m.Faturamento += v.ValorTotal
		if v.Produto.CustoUnitario != nil {
			m.Lucro += v.ValorTotal - (*v.Produto.CustoUnitario * float64(v.Quantidade))
		}
	}
	return m
}

// rankingProdutos lista os produtos mais vendidos (por quantidade) no
// intervalo — mesma ideia do ranking de serviços, só que não separa por
// quantidade/faturamento porque a lista de produtos tende a ser bem menor
// que a de agendamentos.
func rankingProdutos(vendas []models.VendaProduto, inicio, fim time.Time) []produtoRankingItem {
	porProduto := map[uint]*produtoRankingItem{}
	for _, v := range vendas {
		dia := time.Date(v.CreatedAt.Year(), v.CreatedAt.Month(), v.CreatedAt.Day(), 0, 0, 0, 0, time.UTC)
		if dia.Before(inicio) || dia.After(fim) {
			continue
		}
		item, ok := porProduto[v.ProdutoID]
		if !ok {
			item = &produtoRankingItem{ProdutoID: v.ProdutoID, Nome: v.Produto.Nome}
			porProduto[v.ProdutoID] = item
		}
		item.Quantidade += v.Quantidade
		item.Faturamento += v.ValorTotal
	}

	lista := make([]produtoRankingItem, 0, len(porProduto))
	for _, item := range porProduto {
		lista = append(lista, *item)
	}
	for i := 1; i < len(lista); i++ {
		for j := i; j > 0 && lista[j].Quantidade > lista[j-1].Quantidade; j-- {
			lista[j], lista[j-1] = lista[j-1], lista[j]
		}
	}
	if len(lista) > 5 {
		lista = lista[:5]
	}
	return lista
}

// Get monta o dashboard inteiro a partir de uma única consulta (últimos 60
// dias até o fim do mês atual) — o resto é derivado em memória, o volume de
// agendamentos de um estabelecimento não justifica várias idas ao banco.
func (h *DashboardHandler) Get(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	agora := time.Now()
	hoje := time.Date(agora.Year(), agora.Month(), agora.Day(), 0, 0, 0, 0, time.UTC)
	inicioMes := time.Date(hoje.Year(), hoje.Month(), 1, 0, 0, 0, 0, time.UTC)
	fimMes := inicioMes.AddDate(0, 1, -1)
	inicioJanela := hoje.AddDate(0, 0, -60)

	query := h.DB.Preload("Servico").Preload("ServicosAdicionais.Servico").
		Where(
			"estabelecimento_id = ? AND status = ? AND data >= ? AND data <= ?",
			estabelecimentoID, models.StatusConfirmado, inicioJanela, fimMes,
		)
	// um auxiliar só vê o próprio desempenho — dados financeiros da empresa
	// toda ficam só com o dono (ver decisão registrada com o usuário). O dono
	// pode filtrar por um ou mais profissionais (multi-seleção).
	query = aplicarFiltroProfissional(c, query)

	var agendamentos []models.Agendamento
	if err := query.Order("data asc").Find(&agendamentos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao carregar dashboard"})
		return
	}

	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, estabelecimentoID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	var usuario models.Usuario
	if err := h.DB.First(&usuario, auth.UsuarioID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar usuário"})
		return
	}
	horarios := horarioDoProfissional(estabelecimento, usuario)

	resposta := dashboardResponse{
		Hoje:          metricasPeriodo(agendamentos, hoje, hoje, agora),
		Semana:        metricasPeriodo(agendamentos, inicioSemana(hoje), fimSemana(hoje), agora),
		Mes:           metricasPeriodo(agendamentos, inicioMes, fimMes, agora),
		Grafico7Dias:  graficoFaturamento(agendamentos, hoje, 7),
		Grafico30Dias: graficoFaturamento(agendamentos, hoje, 30),
	}
	resposta.RankingQuantidade, resposta.RankingFaturamento = ranking(agendamentos, inicioMes, fimMes)
	resposta.Sugestoes = gerarSugestoes(agendamentos, horarios, hoje, agora)

	// produtos: só o dono vê (ver comentário em dashboardResponse) — um
	// auxiliar recebe os campos zerados/vazios, sem consulta extra ao banco.
	if auth.Papel(c) != models.PapelAuxiliar {
		var vendasProdutos []models.VendaProduto
		err := h.DB.Preload("Produto").
			Where(
				"estabelecimento_id = ? AND tipo_comprador = ? AND cancelada = ? AND created_at >= ?",
				estabelecimentoID, models.CompradorCliente, false, inicioJanela,
			).
			Find(&vendasProdutos).Error
		if err == nil {
			resposta.ProdutosHoje = metricasProdutos(vendasProdutos, hoje, hoje)
			resposta.ProdutosSemana = metricasProdutos(vendasProdutos, inicioSemana(hoje), fimSemana(hoje))
			resposta.ProdutosMes = metricasProdutos(vendasProdutos, inicioMes, fimMes)
			resposta.ProdutosMaisVendidos = rankingProdutos(vendasProdutos, inicioMes, fimMes)
		}
	}

	c.JSON(http.StatusOK, resposta)
}

// agendamentosParaExportar resolve o período (hoje/semana/mês, mesmo
// vocabulário dos cards do dashboard) e busca os agendamentos confirmados
// dele — usado pelos três formatos de exportação (CSV, XLSX, PDF), que só
// diferem em como escrevem esses mesmos dados. Mesma regra de escopo do
// resto do dashboard: auxiliar só exporta a própria agenda.
func (h *DashboardHandler) agendamentosParaExportar(c *gin.Context) ([]models.Agendamento, error) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	agora := time.Now()
	hoje := time.Date(agora.Year(), agora.Month(), agora.Day(), 0, 0, 0, 0, time.UTC)

	var inicio, fim time.Time
	switch c.Query("periodo") {
	case "hoje":
		inicio, fim = hoje, hoje
	case "semana":
		inicio, fim = inicioSemana(hoje), fimSemana(hoje)
	case "mes":
		inicio = time.Date(hoje.Year(), hoje.Month(), 1, 0, 0, 0, 0, time.UTC)
		fim = inicio.AddDate(0, 1, -1)
	default:
		return nil, fmt.Errorf("parâmetro 'periodo' inválido — use hoje, semana ou mes")
	}

	query := h.DB.Preload("Servico").Preload("ServicosAdicionais.Servico").Preload("Cliente").
		Where(
			"estabelecimento_id = ? AND status = ? AND data >= ? AND data <= ?",
			estabelecimentoID, models.StatusConfirmado, inicio, fim,
		)
	query = aplicarFiltroProfissional(c, query)

	var agendamentos []models.Agendamento
	err := query.Order("data asc, hora asc").Find(&agendamentos).Error
	return agendamentos, err
}

// CSV exporta os agendamentos confirmados de um dos períodos que os cards
// do dashboard já calculam — não é uma tela nova, é uma ação em cima dos
// mesmos dados.
func (h *DashboardHandler) CSV(c *gin.Context) {
	agendamentos, err := h.agendamentosParaExportar(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="agendamentos.csv"`)

	// ';' em vez de ',' — é o separador que o Excel em pt-BR espera por
	// padrão (a vírgula já é o separador decimal nesse locale).
	writer := csv.NewWriter(c.Writer)
	writer.Comma = ';'
	writer.Write([]string{"Data", "Cliente", "Serviço", "Valor", "Pago"})
	for _, a := range agendamentos {
		writer.Write([]string{
			a.Data.Format("02/01/2006"),
			a.Cliente.Nome,
			nomesServicos(a.TodosServicos()),
			formatarReais(valorAgendamento(a)),
			simOuNao(a.Pago),
		})
	}
	writer.Flush()
}

// XLSX gera a mesma exportação em planilha formatada (cabeçalho em negrito,
// larguras de coluna ajustadas, valores como número com formato monetário
// de verdade — não como texto "R$ x,xx" — pra dar pra somar/filtrar direto
// no Excel/Sheets).
func (h *DashboardHandler) XLSX(c *gin.Context) {
	agendamentos, err := h.agendamentosParaExportar(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	f := excelize.NewFile()
	defer f.Close()
	const aba = "Agendamentos"
	f.SetSheetName("Sheet1", aba)

	cabecalho := []string{"Data", "Cliente", "Serviço", "Valor", "Pago"}
	estiloCabecalho, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"0C7C71"}, Pattern: 1},
	})
	estiloMoeda, _ := f.NewStyle(&excelize.Style{CustomNumFmt: strPtr(`"R$" #,##0.00`)})

	for i, titulo := range cabecalho {
		celula, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(aba, celula, titulo)
	}
	f.SetCellStyle(aba, "A1", "E1", estiloCabecalho)

	var totalFaturamento float64
	linha := 2
	for _, a := range agendamentos {
		f.SetCellValue(aba, fmt.Sprintf("A%d", linha), a.Data.Format("02/01/2006"))
		f.SetCellValue(aba, fmt.Sprintf("B%d", linha), a.Cliente.Nome)
		f.SetCellValue(aba, fmt.Sprintf("C%d", linha), nomesServicos(a.TodosServicos()))
		f.SetCellValue(aba, fmt.Sprintf("D%d", linha), valorAgendamento(a))
		f.SetCellStyle(aba, fmt.Sprintf("D%d", linha), fmt.Sprintf("D%d", linha), estiloMoeda)
		f.SetCellValue(aba, fmt.Sprintf("E%d", linha), simOuNao(a.Pago))
		totalFaturamento += valorAgendamento(a)
		linha++
	}

	if len(agendamentos) > 0 {
		estiloTotalLabel, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
		estiloTotalValor, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}, CustomNumFmt: strPtr(`"R$" #,##0.00`)})
		f.SetCellValue(aba, fmt.Sprintf("C%d", linha), "Total")
		f.SetCellStyle(aba, fmt.Sprintf("C%d", linha), fmt.Sprintf("C%d", linha), estiloTotalLabel)
		f.SetCellValue(aba, fmt.Sprintf("D%d", linha), totalFaturamento)
		f.SetCellStyle(aba, fmt.Sprintf("D%d", linha), fmt.Sprintf("D%d", linha), estiloTotalValor)
	}

	f.SetColWidth(aba, "A", "A", 14)
	f.SetColWidth(aba, "B", "B", 26)
	f.SetColWidth(aba, "C", "C", 22)
	f.SetColWidth(aba, "D", "D", 14)
	f.SetColWidth(aba, "E", "E", 8)

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", `attachment; filename="agendamentos.xlsx"`)
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar planilha"})
	}
}

// PDF gera um resumo tabular pra imprimir ou enviar — só a lista de
// agendamentos do período e os totais (recebido/a receber/geral), sem
// reproduzir os gráficos do dashboard (ver CLAUDE.md).
func (h *DashboardHandler) PDF(c *gin.Context) {
	agendamentos, err := h.agendamentosParaExportar(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var estabelecimento models.Estabelecimento
	h.DB.First(&estabelecimento, auth.EstabelecimentoID(c))

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(0, 8, transliterar(estabelecimento.Nome), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 11)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 6, transliterar("Relatório de agendamentos - "+rotuloPeriodo(c.Query("periodo"))), "", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(4)

	// cabeçalho da tabela
	larguras := []float64{28, 55, 55, 27, 15}
	titulos := []string{"Data", "Cliente", "Servico", "Valor", "Pago"}
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetFillColor(12, 124, 113)
	pdf.SetTextColor(255, 255, 255)
	for i, titulo := range titulos {
		pdf.CellFormat(larguras[i], 8, titulo, "1", 0, "L", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(0, 0, 0)
	var totalGeral, totalRecebido, totalAReceber float64
	linhaCor := false
	for _, a := range agendamentos {
		if linhaCor {
			pdf.SetFillColor(245, 245, 244)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		linhaCor = !linhaCor
		pdf.CellFormat(larguras[0], 7, a.Data.Format("02/01/2006"), "1", 0, "L", true, 0, "")
		pdf.CellFormat(larguras[1], 7, transliterar(a.Cliente.Nome), "1", 0, "L", true, 0, "")
		pdf.CellFormat(larguras[2], 7, transliterar(nomesServicos(a.TodosServicos())), "1", 0, "L", true, 0, "")
		pdf.CellFormat(larguras[3], 7, transliterar(formatarReais(valorAgendamento(a))), "1", 0, "R", true, 0, "")
		pdf.CellFormat(larguras[4], 7, simOuNao(a.Pago), "1", 0, "C", true, 0, "")
		pdf.Ln(-1)

		totalGeral += valorAgendamento(a)
		if a.Pago {
			totalRecebido += valorAgendamento(a)
		} else {
			totalAReceber += valorAgendamento(a)
		}
	}

	pdf.Ln(6)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(0, 7, transliterar(fmt.Sprintf("Total: %s  (%d agendamentos)", formatarReais(totalGeral), len(agendamentos))), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(90, 147, 103)
	pdf.CellFormat(0, 6, transliterar("Recebido: "+formatarReais(totalRecebido)), "", 1, "L", false, 0, "")
	pdf.SetTextColor(214, 154, 52)
	pdf.CellFormat(0, 6, transliterar("A receber: "+formatarReais(totalAReceber)), "", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", `attachment; filename="agendamentos.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar PDF"})
	}
}

func simOuNao(v bool) string {
	if v {
		return "Sim"
	}
	return "Não"
}

func rotuloPeriodo(periodo string) string {
	switch periodo {
	case "hoje":
		return "Hoje"
	case "semana":
		return "Essa semana"
	case "mes":
		return "Esse mes"
	default:
		return periodo
	}
}

func strPtr(s string) *string { return &s }

// transliterar troca acentos/cê-cedilha por equivalentes ASCII — a fonte
// Helvetica padrão do fpdf não cobre Latin-1 supplement direito (usa a
// codificação core de 14 fontes do PDF), então texto acentuado sairia
// corrompido sem isso. Custo aceitável: só a exportação em PDF perde os
// acentos, CSV e XLSX continuam com o texto original.
func transliterar(s string) string {
	substituicoes := strings.NewReplacer(
		"á", "a", "à", "a", "ã", "a", "â", "a", "ä", "a",
		"é", "e", "ê", "e", "è", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "õ", "o", "ô", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c", "ñ", "n",
		"Á", "A", "À", "A", "Ã", "A", "Â", "A", "Ä", "A",
		"É", "E", "Ê", "E", "È", "E", "Ë", "E",
		"Í", "I", "Ì", "I", "Î", "I", "Ï", "I",
		"Ó", "O", "Ò", "O", "Õ", "O", "Ô", "O", "Ö", "O",
		"Ú", "U", "Ù", "U", "Û", "U", "Ü", "U",
		"Ç", "C", "Ñ", "N",
	)
	return substituicoes.Replace(s)
}

func inicioSemana(dia time.Time) time.Time {
	return dia.AddDate(0, 0, -int(dia.Weekday()))
}

func fimSemana(dia time.Time) time.Time {
	return inicioSemana(dia).AddDate(0, 0, 6)
}

func momentoAgendamento(a models.Agendamento) time.Time {
	min, err := minutosDoDia(a.Hora)
	if err != nil {
		min = 0
	}
	return time.Date(a.Data.Year(), a.Data.Month(), a.Data.Day(), min/60, min%60, 0, 0, time.UTC)
}

func metricasPeriodo(agendamentos []models.Agendamento, inicio, fim, agora time.Time) periodoMetricas {
	m := periodoMetricas{}
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(fim) {
			continue
		}
		m.Agendamentos++
		m.Faturamento += valorAgendamento(a)
		if a.Pago {
			m.Recebido += valorAgendamento(a)
		} else {
			m.AReceber += valorAgendamento(a)
		}
		if momentoAgendamento(a).After(agora) {
			m.AindaVaoAcontecer++
		}
	}
	return m
}

func somaPeriodo(agendamentos []models.Agendamento, inicio, fim time.Time) float64 {
	var soma float64
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(fim) {
			continue
		}
		soma += valorAgendamento(a)
	}
	return soma
}

func graficoFaturamento(agendamentos []models.Agendamento, hoje time.Time, dias int) []pontoGrafico {
	inicio := hoje.AddDate(0, 0, -(dias - 1))
	porDia := make(map[string]float64)
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(hoje) {
			continue
		}
		porDia[a.Data.Format("2006-01-02")] += valorAgendamento(a)
	}

	pontos := make([]pontoGrafico, 0, dias)
	for d := 0; d < dias; d++ {
		chave := inicio.AddDate(0, 0, d).Format("2006-01-02")
		pontos = append(pontos, pontoGrafico{Data: chave, Valor: porDia[chave]})
	}
	return pontos
}

// valorPorServico rateia o valor total de UM agendamento entre os serviços
// que ele tem — proporcional ao preço de catálogo de cada um (quem custa
// mais leva uma fatia maior), ou dividido em partes iguais quando nenhum
// serviço do agendamento tem preço cadastrado (não há nenhum sinal pra
// ratear por peso). No caso mais comum — um serviço só — devolve o valor
// inteiro pra ele, exatamente como antes de existir agendamento combo.
func valorPorServico(a models.Agendamento) map[uint]float64 {
	servicos := a.TodosServicos()
	resultado := make(map[uint]float64, len(servicos))
	if len(servicos) == 0 {
		return resultado
	}

	total := valorAgendamento(a)
	var somaPesos float64
	pesos := make(map[uint]float64, len(servicos))
	for _, s := range servicos {
		peso := 0.0
		if s.Preco != nil {
			peso = *s.Preco
		}
		pesos[s.ID] += peso
		somaPesos += peso
	}

	for _, s := range servicos {
		if somaPesos > 0 {
			resultado[s.ID] += total * (pesos[s.ID] / somaPesos)
		} else {
			resultado[s.ID] += total / float64(len(servicos))
		}
	}
	return resultado
}

// ranking conta quantas vezes cada serviço apareceu (em qualquer
// agendamento, principal ou adicional) e quanto rateado ele faturou — ver
// valorPorServico. Um agendamento com 2 serviços conta 1 pra cada um, não 2
// pro mesmo agendamento.
func ranking(agendamentos []models.Agendamento, inicio, fim time.Time) ([]rankingItem, []rankingItem) {
	porServico := map[uint]*rankingItem{}
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(fim) {
			continue
		}
		alocado := valorPorServico(a)
		for _, s := range a.TodosServicos() {
			item, ok := porServico[s.ID]
			if !ok {
				item = &rankingItem{ServicoID: s.ID, Nome: s.Nome, Cor: s.Cor}
				porServico[s.ID] = item
			}
			item.Quantidade++
			item.Faturamento += alocado[s.ID]
		}
	}

	lista := make([]rankingItem, 0, len(porServico))
	for _, item := range porServico {
		lista = append(lista, *item)
	}

	porQtd := ordenarERecortar(lista, func(a, b rankingItem) bool { return a.Quantidade > b.Quantidade })
	porFat := ordenarERecortar(lista, func(a, b rankingItem) bool { return a.Faturamento > b.Faturamento })
	return porQtd, porFat
}

func ordenarERecortar(lista []rankingItem, menor func(a, b rankingItem) bool) []rankingItem {
	copia := make([]rankingItem, len(lista))
	copy(copia, lista)
	for i := 1; i < len(copia); i++ {
		for j := i; j > 0 && menor(copia[j], copia[j-1]); j-- {
			copia[j], copia[j-1] = copia[j-1], copia[j]
		}
	}
	if len(copia) > 5 {
		copia = copia[:5]
	}
	return copia
}

// duracaoMediaMinutos estima quanto tempo um agendamento "típico" ocupa,
// usada pra converter minutos livres em número de atendimentos possíveis.
func duracaoMediaMinutos(agendamentos []models.Agendamento) float64 {
	if len(agendamentos) == 0 {
		return 0
	}
	var soma int
	for _, a := range agendamentos {
		soma += a.DuracaoTotalEfetivaMin()
	}
	return float64(soma) / float64(len(agendamentos))
}

// ocupacaoNoPeriodo retorna (minutos disponíveis, minutos ocupados) em
// [inicio, fim], considerando só os dias em que o estabelecimento abre.
func ocupacaoNoPeriodo(agendamentos []models.Agendamento, horarios models.HorarioFuncionamento, inicio, fim time.Time) (float64, float64) {
	var disponivel float64
	for d := inicio; !d.After(fim); d = d.AddDate(0, 0, 1) {
		dia, ok := horarios[models.DiasSemana[int(d.Weekday())]]
		if !ok || dia.Fechado {
			continue
		}
		abre, err1 := minutosDoDia(dia.Abre)
		fecha, err2 := minutosDoDia(dia.Fecha)
		if err1 != nil || err2 != nil || abre >= fecha {
			continue
		}
		disponivel += float64(fecha - abre)
	}

	var ocupado float64
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(fim) {
			continue
		}
		ocupado += float64(a.DuracaoTotalEfetivaMin())
	}
	return disponivel, ocupado
}

// diaComMaiorQueda compara, dia da semana a dia da semana, o faturamento
// desta semana com o da semana passada, e aponta onde a queda foi maior.
func diaComMaiorQueda(agendamentos []models.Agendamento, inicioAtual, inicioPassado time.Time) (string, float64) {
	rotulos := []string{"domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"}
	var porDiaAtual, porDiaPassado [7]float64

	for _, a := range agendamentos {
		if offset := diasDesde(inicioAtual, a.Data); offset >= 0 && offset < 7 {
			porDiaAtual[offset] += valorAgendamento(a)
		}
		if offset := diasDesde(inicioPassado, a.Data); offset >= 0 && offset < 7 {
			porDiaPassado[offset] += valorAgendamento(a)
		}
	}

	maiorQueda := 0.0
	diaEscolhido := ""
	for i := range 7 {
		if queda := porDiaPassado[i] - porDiaAtual[i]; queda > maiorQueda {
			maiorQueda = queda
			diaEscolhido = rotulos[i]
		}
	}
	return diaEscolhido, maiorQueda
}

func diasDesde(referencia, data time.Time) int {
	return int(data.Sub(referencia).Hours() / 24)
}

// servicoParaPromover aponta, entre os serviços com agendamento no
// intervalo, aquele com a procura mais fraca em relação aos demais — pensado
// pra funcionar tanto na visão do estabelecimento inteiro quanto na de um
// profissional específico (os agendamentos já vêm filtrados por quem chama,
// ver aplicarFiltroProfissional), o que já entrega a "análise entre cada
// profissional e ele mesmo como dono" pedida: basta olhar o dashboard com um
// profissional selecionado no filtro que já existe.
//
// Só sugere quando:
//   - há pelo menos 2 serviços diferentes com agendamento no período (com 1
//     só não há com o que comparar);
//   - o mais fraco não empata com o mais forte (evita "sugerir" quando todo
//     mundo tem a mesma quantidade, o que não é fraqueza nenhuma);
//   - a diferença é grande o bastante pra não ser só ruído — menos de 60% da
//     média dos OUTROS serviços (excluindo o próprio fraco da média, senão
//     ele puxaria a própria comparação pra baixo).
//
// nomeTop é o serviço com mais procura no mesmo período — usado como
// sugestão concreta de combo/pacote, não é feito só de texto genérico.
func servicoParaPromover(agendamentos []models.Agendamento, inicio, fim time.Time) (nomeFraco string, qtdFraco int, mediaOutros float64, nomeTop string, ok bool) {
	porServico := map[uint]int{}
	nomePorServico := map[uint]string{}
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(fim) {
			continue
		}
		for _, s := range a.TodosServicos() {
			porServico[s.ID]++
			nomePorServico[s.ID] = s.Nome
		}
	}
	if len(porServico) < 2 {
		return "", 0, 0, "", false
	}

	var idFraco, idTop uint
	qtdTop, qtdFracoAtual := -1, -1
	for id, qtd := range porServico {
		if qtdTop == -1 || qtd > qtdTop {
			qtdTop, idTop = qtd, id
		}
		if qtdFracoAtual == -1 || qtd < qtdFracoAtual {
			qtdFracoAtual, idFraco = qtd, id
		}
	}
	if idFraco == idTop {
		// todo mundo com a mesma quantidade — não há "fraco" de verdade.
		return "", 0, 0, "", false
	}

	var somaOutros, count int
	for id, qtd := range porServico {
		if id == idFraco {
			continue
		}
		somaOutros += qtd
		count++
	}
	if count == 0 {
		return "", 0, 0, "", false
	}
	media := float64(somaOutros) / float64(count)
	if media <= 0 || float64(qtdFracoAtual) >= media*0.6 {
		return "", 0, 0, "", false
	}

	return nomePorServico[idFraco], qtdFracoAtual, media, nomePorServico[idTop], true
}

// gerarSugestoes aplica regras determinísticas sobre os dados reais do
// estabelecimento — nunca IA generativa, nunca um valor genérico (ver
// CLAUDE.md). No máximo 3 cartões, e nunca um tom de cobrança quando já
// está indo bem.
func gerarSugestoes(agendamentos []models.Agendamento, horarios models.HorarioFuncionamento, hoje, agora time.Time) []sugestao {
	inicioMes := time.Date(hoje.Year(), hoje.Month(), 1, 0, 0, 0, 0, time.UTC)

	var somaMes float64
	var qtdMes int
	for _, a := range agendamentos {
		if a.Data.Before(inicioMes) || a.Data.After(hoje) {
			continue
		}
		somaMes += valorAgendamento(a)
		qtdMes++
	}
	if qtdMes == 0 {
		return []sugestao{} // sem histórico ainda pra sugerir algo com número real
	}
	ticketMedio := somaMes / float64(qtdMes)
	duracaoMedia := duracaoMediaMinutos(agendamentos)

	inicioSemanaAtual := inicioSemana(hoje)
	fimSemanaAtual := fimSemana(hoje)
	inicioSemanaPassada := inicioSemanaAtual.AddDate(0, 0, -7)
	fimSemanaPassada := inicioSemanaAtual.AddDate(0, 0, -1)

	sugestoes := []sugestao{}

	minutosDisponiveis, minutosOcupados := ocupacaoNoPeriodo(agendamentos, horarios, inicioSemanaAtual, fimSemanaAtual)
	ocupacao := 0.0
	if minutosDisponiveis > 0 {
		ocupacao = minutosOcupados / minutosDisponiveis
	}

	if minutosDisponiveis > 0 && ocupacao < 0.5 && duracaoMedia > 0 {
		vagos := minutosDisponiveis - minutosOcupados
		potencial := (vagos / duracaoMedia) * ticketMedio
		sugestoes = append(sugestoes, sugestao{
			Tipo:   "alerta",
			Titulo: "Ocupação baixa essa semana",
			Descricao: fmt.Sprintf(
				"Sua agenda está com %.0f%% de ocupação essa semana. Preencher os horários livres renderia cerca de %s, com base no seu ticket médio.",
				ocupacao*100, formatarReais(potencial),
			),
		})
	}

	faturamentoAtual := somaPeriodo(agendamentos, inicioSemanaAtual, fimSemanaAtual)
	faturamentoPassado := somaPeriodo(agendamentos, inicioSemanaPassada, fimSemanaPassada)
	if faturamentoPassado > 0 && faturamentoAtual < faturamentoPassado*0.9 {
		dia, queda := diaComMaiorQueda(agendamentos, inicioSemanaAtual, inicioSemanaPassada)
		if dia != "" {
			percentual := (1 - faturamentoAtual/faturamentoPassado) * 100
			sugestoes = append(sugestoes, sugestao{
				Tipo:   "alerta",
				Titulo: "Faturamento caiu essa semana",
				Descricao: fmt.Sprintf(
					"O faturamento está %.0f%% menor que a semana passada, principalmente às %s (queda de %s).",
					percentual, dia, formatarReais(queda),
				),
			})
		}
	}

	// serviço com procura fraca: soa como alerta quando já existe outro
	// alerta nessa mesma passada (o estabelecimento já não está indo bem,
	// então é mais um ponto de atenção); soa como oportunidade quando o
	// resto está indo bem — nunca em tom de cobrança nesse caso (ver
	// CLAUDE.md "Motor de sugestões de faturamento").
	haAlerta := len(sugestoes) > 0
	if nomeFraco, qtdFraco, mediaOutros, nomeTop, ok := servicoParaPromover(agendamentos, inicioMes, hoje); ok {
		if haAlerta {
			sugestoes = append(sugestoes, sugestao{
				Tipo:   "alerta",
				Titulo: "Um serviço está com procura baixa",
				Descricao: fmt.Sprintf(
					"\"%s\" teve %d agendamento(s) esse mês, bem abaixo da média de %.0f dos outros serviços. Considere uma promoção por tempo limitado nele, ou um combo junto com \"%s\" (seu serviço mais procurado) pra apresentar o serviço fraco a quem já vem pelo popular.",
					nomeFraco, qtdFraco, mediaOutros, nomeTop,
				),
			})
		} else {
			sugestoes = append(sugestoes, sugestao{
				Tipo:   "incentivo",
				Titulo: "Oportunidade de crescer ainda mais",
				Descricao: fmt.Sprintf(
					"\"%s\" teve %d agendamento(s) esse mês, contra uma média de %.0f dos outros serviços — ainda tem espaço pra crescer. Um combo com \"%s\" (seu mais procurado) ou uma promoção por tempo limitado pode ajudar a apresentá-lo pra mais gente.",
					nomeFraco, qtdFraco, mediaOutros, nomeTop,
				),
			})
		}
	}

	if !haAlerta {
		if minutosDisponiveis > 0 && duracaoMedia > 0 {
			potencialTeto := (minutosDisponiveis / duracaoMedia) * ticketMedio
			sugestoes = append(sugestoes, sugestao{
				Tipo:   "incentivo",
				Titulo: "Sua agenda está indo bem",
				Descricao: fmt.Sprintf(
					"Com %.0f%% de ocupação essa semana, se a agenda lotasse 100%%, o faturamento chegaria a cerca de %s.",
					ocupacao*100, formatarReais(potencialTeto),
				),
			})
		}

		if diasPassados := hoje.Day(); diasPassados > 0 {
			diasTotais := time.Date(hoje.Year(), hoje.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
			somaAteHoje := somaPeriodo(agendamentos, inicioMes, hoje)
			projecao := (somaAteHoje / float64(diasPassados)) * float64(diasTotais)
			sugestoes = append(sugestoes, sugestao{
				Tipo:   "incentivo",
				Titulo: "Projeção do mês",
				Descricao: fmt.Sprintf(
					"No ritmo atual, o faturamento deve fechar o mês em torno de %s.",
					formatarReais(projecao),
				),
			})
		}
	}

	if len(sugestoes) > 3 {
		sugestoes = sugestoes[:3]
	}
	return sugestoes
}
