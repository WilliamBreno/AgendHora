package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

func formatarReais(valor float64) string {
	return "R$ " + strings.Replace(fmt.Sprintf("%.2f", valor), ".", ",", 1)
}

type DashboardHandler struct {
	DB *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{DB: db}
}

type periodoMetricas struct {
	Agendamentos      int     `json:"agendamentos"`
	Faturamento       float64 `json:"faturamento"`
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

	query := h.DB.Preload("Servico").
		Where(
			"estabelecimento_id = ? AND status = ? AND data >= ? AND data <= ?",
			estabelecimentoID, models.StatusConfirmado, inicioJanela, fimMes,
		)
	// um auxiliar só vê o próprio desempenho — dados financeiros da empresa
	// toda ficam só com o dono (ver decisão registrada com o usuário).
	if auth.Papel(c) == models.PapelAuxiliar {
		query = query.Where("profissional_id = ?", auth.UsuarioID(c))
	}

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

	c.JSON(http.StatusOK, resposta)
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
		m.Faturamento += a.Servico.Preco
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
		soma += a.Servico.Preco
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
		porDia[a.Data.Format("2006-01-02")] += a.Servico.Preco
	}

	pontos := make([]pontoGrafico, 0, dias)
	for d := 0; d < dias; d++ {
		chave := inicio.AddDate(0, 0, d).Format("2006-01-02")
		pontos = append(pontos, pontoGrafico{Data: chave, Valor: porDia[chave]})
	}
	return pontos
}

func ranking(agendamentos []models.Agendamento, inicio, fim time.Time) ([]rankingItem, []rankingItem) {
	porServico := map[uint]*rankingItem{}
	for _, a := range agendamentos {
		if a.Data.Before(inicio) || a.Data.After(fim) {
			continue
		}
		item, ok := porServico[a.ServicoID]
		if !ok {
			item = &rankingItem{ServicoID: a.ServicoID, Nome: a.Servico.Nome, Cor: a.Servico.Cor}
			porServico[a.ServicoID] = item
		}
		item.Quantidade++
		item.Faturamento += a.Servico.Preco
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
		soma += a.Servico.DuracaoMin
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
		ocupado += float64(a.Servico.DuracaoMin)
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
			porDiaAtual[offset] += a.Servico.Preco
		}
		if offset := diasDesde(inicioPassado, a.Data); offset >= 0 && offset < 7 {
			porDiaPassado[offset] += a.Servico.Preco
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
		somaMes += a.Servico.Preco
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

	if len(sugestoes) == 0 {
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
