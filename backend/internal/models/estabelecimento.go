package models

import (
	"time"

	"gorm.io/datatypes"
)

// IconesPadraoDefault é o conjunto inicial de ícones sugerido ao criar o
// estabelecimento. O dono pode adicionar/remover livremente depois em
// Configurações — o seletor de ícone do serviço sempre lê de IconesPadrao,
// nunca deste array.
var IconesPadraoDefault = []string{
	"Scissors", "Sparkles", "Heart", "Palette", "Brush", "Flower2",
	"Hand", "Droplet", "Droplets", "Sun", "Star", "Gem",
	"Syringe", "HandHeart", "Wind", "Feather", "Bath", "SprayCan",
	"Flame", "Leaf", "Smile", "ShowerHead",
}

// Estabelecimento representa uma empresa cadastrada na plataforma (multi-tenant:
// cada uma tem seus próprios usuários, serviços e agendamentos).
type Estabelecimento struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Nome     string `gorm:"not null" json:"nome"`
	Telefone string `json:"telefone"`
	Endereco string `json:"endereco"`
	// Email recebe a notificação de "novo agendamento" (ver internal/notifications).
	Email string `json:"email"`

	// Slug identifica a empresa na URL pública (ex: agendhora.app/salao-da-maria).
	// Gerado a partir do nome no cadastro, único, nunca muda depois de criado.
	// Sem "not null" no banco de propósito: isso permite ADD COLUMN em cima de
	// linhas existentes sem quebrar a migration; a obrigatoriedade é garantida
	// na aplicação (handlers.Registro sempre define um slug, e MigrarSlugsLegados
	// preenche qualquer linha antiga que não tinha esse campo).
	Slug string `gorm:"uniqueIndex" json:"slug"`

	// Logo é a imagem da empresa como data URI base64 (ex: "data:image/png;base64,...").
	// Guardada direto no banco por simplicidade — a v1 não precisa de um serviço
	// de armazenamento de arquivos à parte pra logos, que são pequenas.
	Logo string `json:"logo"`

	// HorarioFuncionamento guarda o horário de funcionamento por dia da semana, ex:
	// {"segunda": {"abre": "09:00", "fecha": "18:00", "fechado": false}, ...}
	HorarioFuncionamento datatypes.JSON `json:"horario_funcionamento"`

	// IconesPadrao é a lista configurável de nomes de ícones lucide-react
	// disponíveis no seletor de ícone do cadastro de serviço, ex: ["Scissors", "Heart"].
	IconesPadrao datatypes.JSON `json:"icones_padrao"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
