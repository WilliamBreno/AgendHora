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
	horario, _ := json.Marshal(horarioFuncionamentoDefault())

	estabelecimento = models.Estabelecimento{
		Nome:                 "Meu Estabelecimento",
		IconesPadrao:         datatypes.JSON(icones),
		HorarioFuncionamento: datatypes.JSON(horario),
	}
	if err := db.Create(&estabelecimento).Error; err != nil {
		log.Fatalf("erro ao criar estabelecimento padrão: %v", err)
	}

	return estabelecimento.ID
}

// horarioFuncionamentoDefault é um horário comercial razoável (seg-sáb,
// 09:00-18:00, domingo fechado) usado só na primeira criação do
// estabelecimento — o dono ajusta em Configurações depois.
func horarioFuncionamentoDefault() models.HorarioFuncionamento {
	horario := models.HorarioFuncionamento{}
	for _, dia := range models.DiasSemana {
		if dia == "domingo" {
			horario[dia] = models.HorarioDia{Fechado: true}
			continue
		}
		horario[dia] = models.HorarioDia{Abre: "09:00", Fecha: "18:00"}
	}
	return horario
}
