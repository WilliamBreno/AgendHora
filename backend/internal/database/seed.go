package database

import (
	"encoding/json"
	"log"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"agendamento/backend/internal/models"
)

// EnsureEstabelecimentoPadrao garante que existe um Estabelecimento cadastrado
// (a v1 é mono-estabelecimento) e retorna o seu ID.
func EnsureEstabelecimentoPadrao(db *gorm.DB) uint {
	var estabelecimento models.Estabelecimento

	err := db.Order("id asc").First(&estabelecimento).Error
	if err == nil {
		return estabelecimento.ID
	}
	if err != gorm.ErrRecordNotFound {
		log.Fatalf("erro ao buscar estabelecimento: %v", err)
	}

	icones, _ := json.Marshal(models.IconesPadraoDefault)

	estabelecimento = models.Estabelecimento{
		Nome:                 "Meu Estabelecimento",
		IconesPadrao:         datatypes.JSON(icones),
		HorarioFuncionamento: datatypes.JSON(`{}`),
	}
	if err := db.Create(&estabelecimento).Error; err != nil {
		log.Fatalf("erro ao criar estabelecimento padrão: %v", err)
	}

	return estabelecimento.ID
}
