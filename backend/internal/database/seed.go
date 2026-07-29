package database

import (
	"log"

	"gorm.io/gorm"

	"agendamento/backend/internal/models"
	"agendamento/backend/internal/slug"
)

// MigrarSlugsLegados preenche o slug de qualquer Estabelecimento criado antes
// da v2 (multi-empresa) ter esse campo. Empresas novas ganham slug no
// cadastro (ver handlers.Registro); isso é só pra não perder dados antigos.
func MigrarSlugsLegados(db *gorm.DB) {
	var legados []models.Estabelecimento
	if err := db.Where("slug = ? OR slug IS NULL", "").Find(&legados).Error; err != nil {
		log.Fatalf("erro ao buscar estabelecimentos sem slug: %v", err)
	}

	for _, estabelecimento := range legados {
		novoSlug, err := slug.GerarUnico(db, estabelecimento.Nome)
		if err != nil {
			log.Fatalf("erro ao gerar slug para estabelecimento %d: %v", estabelecimento.ID, err)
		}
		if err := db.Model(&estabelecimento).Update("slug", novoSlug).Error; err != nil {
			log.Fatalf("erro ao migrar slug do estabelecimento %d: %v", estabelecimento.ID, err)
		}
		log.Printf("estabelecimento %d migrado para slug %q", estabelecimento.ID, novoSlug)
	}
}
