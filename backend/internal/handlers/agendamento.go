package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
	"agendamento/backend/internal/notifications"
)

type AgendamentoHandler struct {
	DB          *gorm.DB
	Notificador *notifications.Notificador
}

func NewAgendamentoHandler(db *gorm.DB, notificador *notifications.Notificador) *AgendamentoHandler {
	return &AgendamentoHandler{DB: db, Notificador: notificador}
}

type agendamentoInput struct {
	ClienteNome     string `json:"cliente_nome" binding:"required"`
	ClienteTelefone string `json:"cliente_telefone" binding:"required"`
	ClienteEmail    string `json:"cliente_email"`
	ServicoID       uint   `json:"servico_id" binding:"required"`
	ProfissionalID  uint   `json:"profissional_id" binding:"required"`
	Data            string `json:"data" binding:"required"` // "2006-01-02"
	Hora            string `json:"hora" binding:"required"` // "15:04"
	Observacoes     string `json:"observacoes"`
	// Encaixe, quando true, autoriza criar mesmo com conflito de horário
	// detectado (ver comentário no model). Só é respeitado em criação feita
	// pelo admin — a rota pública nunca aceita encaixe.
	Encaixe bool `json:"encaixe"`
}

// agendamentoResponse formata Data como "2006-01-02" (o model guarda um
// time.Time por causa do tipo `date` do Postgres, mas isso não deve vazar
// como timestamp/timezone para o cliente). Os campos cliente_* continuam no
// mesmo formato plano de antes (o frontend não precisa mudar nada) — só
// passaram a vir de a.Cliente, não mais de colunas soltas no Agendamento.
type agendamentoResponse struct {
	ID                uint                     `json:"id"`
	ClienteID         uint                     `json:"cliente_id"`
	ClienteNome       string                   `json:"cliente_nome"`
	ClienteTelefone   string                   `json:"cliente_telefone"`
	ClienteEmail      string                   `json:"cliente_email"`
	ServicoID         uint                     `json:"servico_id"`
	Servico           models.Servico           `json:"servico"`
	ProfissionalID    uint                     `json:"profissional_id"`
	ProfissionalNome  string                   `json:"profissional_nome"`
	Data              string                   `json:"data"`
	Hora              string                   `json:"hora"`
	Status            models.StatusAgendamento `json:"status"`
	Observacoes       string                   `json:"observacoes"`
	Encaixe           bool                     `json:"encaixe"`
	Pago              bool                     `json:"pago"`
	EstabelecimentoID uint                     `json:"estabelecimento_id"`
	CreatedAt         time.Time                `json:"created_at"`
	UpdatedAt         time.Time                `json:"updated_at"`
}

func toAgendamentoResponse(a models.Agendamento) agendamentoResponse {
	return agendamentoResponse{
		ID:                a.ID,
		ClienteID:         a.ClienteID,
		ClienteNome:       a.Cliente.Nome,
		ClienteTelefone:   a.Cliente.Telefone,
		ClienteEmail:      a.Cliente.Email,
		ServicoID:         a.ServicoID,
		Servico:           a.Servico,
		ProfissionalID:    a.ProfissionalID,
		ProfissionalNome:  a.Profissional.Nome,
		Data:              a.Data.Format("2006-01-02"),
		Hora:              a.Hora,
		Status:            a.Status,
		Observacoes:       a.Observacoes,
		Encaixe:           a.Encaixe,
		Pago:              a.Pago,
		EstabelecimentoID: a.EstabelecimentoID,
		CreatedAt:         a.CreatedAt,
		UpdatedAt:         a.UpdatedAt,
	}
}

// encontrarOuCriarCliente casa um cliente já existente pelo telefone dentro
// do estabelecimento (ver models.Cliente) ou cria um novo — nunca há
// cadastro manual, o cliente nasce do próprio agendamento. Nome e telefone
// são sempre atualizados pro valor mais recente informado; e-mail só é
// sobrescrito quando vem preenchido, pra não apagar um e-mail já salvo de
// uma vez anterior.
func encontrarOuCriarCliente(db *gorm.DB, estabelecimentoID uint, nome, telefone, email string) (*models.Cliente, error) {
	telefoneNormalizado := apenasDigitos(telefone)

	var cliente models.Cliente
	err := db.Where(
		"estabelecimento_id = ? AND regexp_replace(telefone, '[^0-9]', '', 'g') = ?",
		estabelecimentoID, telefoneNormalizado,
	).First(&cliente).Error
	if err == gorm.ErrRecordNotFound {
		cliente = models.Cliente{
			Nome:              nome,
			Telefone:          telefone,
			Email:             email,
			EstabelecimentoID: estabelecimentoID,
		}
		if err := db.Create(&cliente).Error; err != nil {
			return nil, err
		}
		return &cliente, nil
	}
	if err != nil {
		return nil, err
	}

	cliente.Nome = nome
	cliente.Telefone = telefone
	if email != "" {
		cliente.Email = email
	}
	if err := db.Save(&cliente).Error; err != nil {
		return nil, err
	}
	return &cliente, nil
}

func minutosDoDia(hora string) (int, error) {
	t, err := time.Parse("15:04", hora)
	if err != nil {
		return 0, err
	}
	return t.Hour()*60 + t.Minute(), nil
}

// apenasDigitos normaliza um telefone pra comparação, ignorando espaços,
// parênteses, traço etc — assim "(11) 99999-8888" e "11999998888" combinam.
func apenasDigitos(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

type intervaloOcupado struct {
	inicio int
	fim    int
}

func sobrepoe(aInicio, aFim, bInicio, bFim int) bool {
	return aInicio < bFim && bInicio < aFim
}

// intervalosOcupados lista, em minutos desde 00:00, os horários já tomados
// por agendamentos confirmados de UM profissional naquele dia — cada
// profissional tem sua própria agenda, então o de outro colega não conta
// como conflito. ignorarID exclui o próprio registro (útil ao reagendar).
// Função livre (não presa a AgendamentoHandler) porque o motor de
// disponibilidade também precisa dela.
func intervalosOcupados(db *gorm.DB, estabelecimentoID, profissionalID uint, data time.Time, ignorarID uint) ([]intervaloOcupado, error) {
	query := db.Preload("Servico").
		Where(
			"estabelecimento_id = ? AND profissional_id = ? AND data = ? AND status = ?",
			estabelecimentoID, profissionalID, data, models.StatusConfirmado,
		)
	if ignorarID != 0 {
		query = query.Where("id <> ?", ignorarID)
	}

	var existentes []models.Agendamento
	if err := query.Find(&existentes).Error; err != nil {
		return nil, err
	}

	intervalos := make([]intervaloOcupado, 0, len(existentes))
	for _, ag := range existentes {
		inicio, err := minutosDoDia(ag.Hora)
		if err != nil {
			continue
		}
		intervalos = append(intervalos, intervaloOcupado{inicio: inicio, fim: inicio + ag.Servico.DuracaoMin})
	}
	return intervalos, nil
}

// haConflito verifica se [hora, hora+duracaoMin) esbarra em algum agendamento
// confirmado já existente naquele dia NA AGENDA DESSE PROFISSIONAL — cada
// profissional (dono ou auxiliar) tem sua própria agenda independente.
func (h *AgendamentoHandler) haConflito(estabelecimentoID, profissionalID uint, data time.Time, hora string, duracaoMin int, ignorarID uint) (bool, error) {
	inicio, err := minutosDoDia(hora)
	if err != nil {
		return false, err
	}
	fim := inicio + duracaoMin

	ocupados, err := intervalosOcupados(h.DB, estabelecimentoID, profissionalID, data, ignorarID)
	if err != nil {
		return false, err
	}
	for _, o := range ocupados {
		if sobrepoe(inicio, fim, o.inicio, o.fim) {
			return true, nil
		}
	}
	return false, nil
}

func (h *AgendamentoHandler) List(c *gin.Context) {
	query := h.DB.Preload("Servico").Preload("Profissional").Preload("Cliente").
		Where("estabelecimento_id = ?", auth.EstabelecimentoID(c))

	// um auxiliar só vê a própria agenda, nunca a dos colegas; o dono vê
	// tudo por padrão e pode filtrar por profissional_id se quiser.
	if auth.Papel(c) == models.PapelAuxiliar {
		query = query.Where("profissional_id = ?", auth.UsuarioID(c))
	} else if profissionalIDStr := c.Query("profissional_id"); profissionalIDStr != "" {
		query = query.Where("profissional_id = ?", profissionalIDStr)
	}

	if inicioStr := c.Query("inicio"); inicioStr != "" {
		inicio, err := time.Parse("2006-01-02", inicioStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'inicio' inválido"})
			return
		}
		query = query.Where("data >= ?", inicio)
	}
	if fimStr := c.Query("fim"); fimStr != "" {
		fim, err := time.Parse("2006-01-02", fimStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'fim' inválido"})
			return
		}
		query = query.Where("data <= ?", fim)
	}

	var agendamentos []models.Agendamento
	if err := query.Order("data asc, hora asc").Find(&agendamentos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar agendamentos"})
		return
	}

	respostas := make([]agendamentoResponse, 0, len(agendamentos))
	for _, a := range agendamentos {
		respostas = append(respostas, toAgendamentoResponse(a))
	}
	c.JSON(http.StatusOK, respostas)
}

// MeusAgendamentos é a rota pública que permite o cliente ver os próprios
// agendamentos digitando o telefone — sem precisar de login.
func (h *AgendamentoHandler) MeusAgendamentos(c *gin.Context) {
	telefone := apenasDigitos(c.Query("telefone"))
	if telefone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "informe o telefone"})
		return
	}

	var agendamentos []models.Agendamento
	err := h.DB.Preload("Servico").Preload("Profissional").Preload("Cliente").
		Joins("JOIN clientes ON clientes.id = agendamentos.cliente_id").
		Where(
			"agendamentos.estabelecimento_id = ? AND regexp_replace(clientes.telefone, '[^0-9]', '', 'g') = ?",
			auth.EstabelecimentoID(c), telefone,
		).
		Order("data desc, hora desc").
		Find(&agendamentos).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar agendamentos"})
		return
	}

	respostas := make([]agendamentoResponse, 0, len(agendamentos))
	for _, a := range agendamentos {
		respostas = append(respostas, toAgendamentoResponse(a))
	}
	c.JSON(http.StatusOK, respostas)
}

// criar cria um agendamento. permitirAdmin habilita comportamento exclusivo
// do painel admin: aceitar encaixe e, se quem está logado é um auxiliar,
// forçar o agendamento pra própria agenda dele (não pode agendar em nome de
// outro profissional). Na rota pública, o profissional vem sempre do que o
// cliente escolheu no formulário.
func (h *AgendamentoHandler) criar(c *gin.Context, permitirAdmin bool) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	var input agendamentoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := time.Parse("2006-01-02", input.Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data inválida"})
		return
	}
	if _, err := time.Parse("15:04", input.Hora); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hora inválida"})
		return
	}

	var servico models.Servico
	err = h.DB.Where("id = ? AND estabelecimento_id = ?", input.ServicoID, estabelecimentoID).
		First(&servico).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusBadRequest, gin.H{"error": "serviço não encontrado"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar serviço"})
		return
	}

	profissionalID := input.ProfissionalID
	if permitirAdmin && auth.Papel(c) == models.PapelAuxiliar {
		profissionalID = auth.UsuarioID(c)
	}
	var totalProfissional int64
	h.DB.Model(&models.Usuario{}).
		Where("id = ? AND estabelecimento_id = ?", profissionalID, estabelecimentoID).
		Count(&totalProfissional)
	if totalProfissional == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "profissional não encontrado"})
		return
	}

	conflito, err := h.haConflito(estabelecimentoID, profissionalID, data, input.Hora, servico.DuracaoMin, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao verificar disponibilidade"})
		return
	}
	encaixe := conflito && permitirAdmin && input.Encaixe
	if conflito && !encaixe {
		c.JSON(http.StatusConflict, gin.H{"error": "horário indisponível"})
		return
	}

	cliente, err := encontrarOuCriarCliente(
		h.DB, estabelecimentoID,
		strings.TrimSpace(input.ClienteNome), strings.TrimSpace(input.ClienteTelefone), strings.TrimSpace(input.ClienteEmail),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao registrar cliente"})
		return
	}

	agendamento := models.Agendamento{
		ClienteID:         cliente.ID,
		ServicoID:         input.ServicoID,
		ProfissionalID:    profissionalID,
		Data:              data,
		Hora:              input.Hora,
		Status:            models.StatusConfirmado,
		Observacoes:       strings.TrimSpace(input.Observacoes),
		Encaixe:           encaixe,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&agendamento).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar agendamento"})
		return
	}
	agendamento.Cliente = *cliente
	agendamento.Servico = servico
	h.DB.First(&agendamento.Profissional, profissionalID)

	if h.Notificador != nil {
		var estabelecimento models.Estabelecimento
		if err := h.DB.First(&estabelecimento, estabelecimentoID).Error; err == nil {
			go h.Notificador.NotificarNovoAgendamento(estabelecimento, agendamento)
		}
	}

	c.JSON(http.StatusCreated, toAgendamentoResponse(agendamento))
}

// Create é usado pelo admin — pode passar encaixe:true pra furar um conflito
// de propósito (atendimento por telefone/balcão, ver painel de agendamento).
func (h *AgendamentoHandler) Create(c *gin.Context) {
	h.criar(c, true)
}

// CreatePublico é o self-service da página pública — nunca aceita encaixe,
// mesmo que o corpo da requisição mande encaixe:true.
func (h *AgendamentoHandler) CreatePublico(c *gin.Context) {
	h.criar(c, false)
}

func (h *AgendamentoHandler) buscarAgendamento(c *gin.Context) (*models.Agendamento, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return nil, false
	}

	var agendamento models.Agendamento
	err = h.DB.Preload("Servico").Preload("Profissional").Preload("Cliente").
		Where("id = ? AND estabelecimento_id = ?", id, auth.EstabelecimentoID(c)).
		First(&agendamento).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "agendamento não encontrado"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar agendamento"})
		return nil, false
	}
	return &agendamento, true
}

func (h *AgendamentoHandler) Get(c *gin.Context) {
	agendamento, ok := h.buscarAgendamento(c)
	if !ok {
		return
	}
	if auth.Papel(c) == models.PapelAuxiliar && agendamento.ProfissionalID != auth.UsuarioID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "você só pode ver agendamentos da sua própria agenda"})
		return
	}
	c.JSON(http.StatusOK, toAgendamentoResponse(*agendamento))
}

// cancelar transiciona o agendamento para "cancelado". Não existe exclusão
// definitiva: cancelar preserva o histórico.
func (h *AgendamentoHandler) cancelar(c *gin.Context, agendamento *models.Agendamento) {
	if agendamento.Status != models.StatusCancelado {
		if err := h.DB.Model(agendamento).Update("status", models.StatusCancelado).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao cancelar agendamento"})
			return
		}
		agendamento.Status = models.StatusCancelado

		if h.Notificador != nil {
			var estabelecimento models.Estabelecimento
			if err := h.DB.First(&estabelecimento, agendamento.EstabelecimentoID).Error; err == nil {
				go h.Notificador.NotificarCancelamento(estabelecimento, *agendamento)
			}
		}
	}

	c.JSON(http.StatusOK, toAgendamentoResponse(*agendamento))
}

// Cancelar é a ação do painel admin (aceitar/recusar ficam para quando o
// interruptor opcional de aprovação manual existir). Um auxiliar só pode
// cancelar agendamento da própria agenda, nunca da de um colega.
func (h *AgendamentoHandler) Cancelar(c *gin.Context) {
	agendamento, ok := h.buscarAgendamento(c)
	if !ok {
		return
	}
	if auth.Papel(c) == models.PapelAuxiliar && agendamento.ProfissionalID != auth.UsuarioID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "você só pode cancelar agendamentos da sua própria agenda"})
		return
	}
	h.cancelar(c, agendamento)
}

type atualizarPagoInput struct {
	Pago bool `json:"pago"`
}

// AtualizarPago liga/desliga a marcação de pago no painel de detalhe — não
// tem relação com o Status do agendamento. Mesma regra de dono/auxiliar do
// resto do painel: auxiliar só mexe na própria agenda.
func (h *AgendamentoHandler) AtualizarPago(c *gin.Context) {
	agendamento, ok := h.buscarAgendamento(c)
	if !ok {
		return
	}
	if auth.Papel(c) == models.PapelAuxiliar && agendamento.ProfissionalID != auth.UsuarioID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "você só pode editar agendamentos da sua própria agenda"})
		return
	}

	var input atualizarPagoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.Model(agendamento).Update("pago", input.Pago).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar pagamento"})
		return
	}
	agendamento.Pago = input.Pago

	c.JSON(http.StatusOK, toAgendamentoResponse(*agendamento))
}

type reagendarInput struct {
	Data    string `json:"data" binding:"required"` // "2006-01-02"
	Hora    string `json:"hora" binding:"required"` // "15:04"
	Encaixe bool   `json:"encaixe"`
}

// Reagendar troca a data/hora de um agendamento existente — mantém cliente,
// serviço e profissional, não cria um novo registro. Reaproveita a mesma
// checagem de conflito/encaixe da criação (ignorarID exclui o próprio
// registro da checagem, senão ele sempre "conflitaria" consigo mesmo).
func (h *AgendamentoHandler) Reagendar(c *gin.Context) {
	agendamento, ok := h.buscarAgendamento(c)
	if !ok {
		return
	}
	if auth.Papel(c) == models.PapelAuxiliar && agendamento.ProfissionalID != auth.UsuarioID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "você só pode reagendar agendamentos da sua própria agenda"})
		return
	}
	if agendamento.Status == models.StatusCancelado {
		c.JSON(http.StatusBadRequest, gin.H{"error": "não é possível reagendar um agendamento cancelado"})
		return
	}

	var input reagendarInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := time.Parse("2006-01-02", input.Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data inválida"})
		return
	}
	if _, err := time.Parse("15:04", input.Hora); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hora inválida"})
		return
	}

	conflito, err := h.haConflito(
		agendamento.EstabelecimentoID, agendamento.ProfissionalID,
		data, input.Hora, agendamento.Servico.DuracaoMin, agendamento.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao verificar disponibilidade"})
		return
	}
	encaixe := conflito && input.Encaixe
	if conflito && !encaixe {
		c.JSON(http.StatusConflict, gin.H{"error": "horário indisponível"})
		return
	}

	err = h.DB.Model(agendamento).Updates(map[string]any{
		"data": data, "hora": input.Hora, "encaixe": encaixe,
	}).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao reagendar"})
		return
	}
	agendamento.Data = data
	agendamento.Hora = input.Hora
	agendamento.Encaixe = encaixe

	c.JSON(http.StatusOK, toAgendamentoResponse(*agendamento))
}

type cancelarPublicoInput struct {
	Telefone string `json:"telefone" binding:"required"`
}

// CancelarPublico deixa o próprio cliente cancelar pela página pública,
// mas só se o telefone enviado bater com o do agendamento — sem isso,
// bastaria adivinhar um ID pra cancelar o horário de outra pessoa.
func (h *AgendamentoHandler) CancelarPublico(c *gin.Context) {
	var input cancelarPublicoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agendamento, ok := h.buscarAgendamento(c)
	if !ok {
		return
	}

	if apenasDigitos(agendamento.Cliente.Telefone) != apenasDigitos(input.Telefone) {
		c.JSON(http.StatusForbidden, gin.H{"error": "telefone não confere com o agendamento"})
		return
	}

	h.cancelar(c, agendamento)
}
