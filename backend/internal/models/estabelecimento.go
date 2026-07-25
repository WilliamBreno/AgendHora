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

// Estabelecimento representa o negócio dono da agenda (v1 é mono-estabelecimento,
// mas o registro fica separado para não travar uma evolução futura para multi-tenant).
type Estabelecimento struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Nome     string `gorm:"not null" json:"nome"`
	Telefone string `json:"telefone"`
	Endereco string `json:"endereco"`

	// HorarioFuncionamento guarda o horário de funcionamento por dia da semana, ex:
	// {"segunda": {"abre": "09:00", "fecha": "18:00", "fechado": false}, ...}
	HorarioFuncionamento datatypes.JSON `json:"horario_funcionamento"`

	// IconesPadrao é a lista configurável de nomes de ícones lucide-react
	// disponíveis no seletor de ícone do cadastro de serviço, ex: ["Scissors", "Heart"].
	IconesPadrao datatypes.JSON `json:"icones_padrao"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
