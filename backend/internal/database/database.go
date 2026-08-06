package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"agendamento/backend/internal/models"
)

// Connect abre a conexão com o Postgres via GORM. FK constraints ficam
// desligadas no migration de propósito: a integridade referencial (ex:
// Agendamento.ProfissionalID) é garantida na aplicação, e novas colunas de
// relação (como profissional_id) só podem ganhar um valor válido DEPOIS de
// um backfill em cima de linhas existentes — uma FK criada no mesmo
// AutoMigrate rejeitaria essas linhas antes do backfill rodar.
func Connect(databaseURL string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
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
		&models.ConviteProfissional{},
	)
	if err != nil {
		log.Fatalf("erro ao rodar migrations: %v", err)
	}
}
