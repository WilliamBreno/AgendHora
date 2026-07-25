package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"agendamento/backend/internal/models"
)

// Connect abre a conexão com o Postgres via GORM.
func Connect(databaseURL string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("erro ao conectar no banco de dados: %v", err)
	}

	return db
}

// Migrate garante que o schema do banco reflete os models atuais.
func Migrate(db *gorm.DB) {
	err := db.AutoMigrate(
		&models.Estabelecimento{},
		&models.Usuario{},
		&models.Servico{},
		&models.Agendamento{},
	)
	if err != nil {
		log.Fatalf("erro ao rodar migrations: %v", err)
	}
}
