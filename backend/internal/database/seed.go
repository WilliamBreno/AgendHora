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

// MigrarProfissionais preenche, para contas criadas antes da funcionalidade
// de profissional auxiliar, os campos novos que ganharam NOT NULL com
// default provisório na migration: Usuario.Nome (cai pro nome do
// estabelecimento) e Agendamento.ProfissionalID (cai pro dono daquele
// estabelecimento — antes só existia um profissional por empresa mesmo).
func MigrarProfissionais(db *gorm.DB) {
	var usuariosSemNome []models.Usuario
	if err := db.Where("nome = ?", "").Find(&usuariosSemNome).Error; err != nil {
		log.Fatalf("erro ao buscar usuários sem nome: %v", err)
	}
	for _, usuario := range usuariosSemNome {
		var estabelecimento models.Estabelecimento
		nome := "Responsável"
		if err := db.First(&estabelecimento, usuario.EstabelecimentoID).Error; err == nil {
			nome = estabelecimento.Nome
		}
		if err := db.Model(&usuario).Update("nome", nome).Error; err != nil {
			log.Fatalf("erro ao migrar nome do usuário %d: %v", usuario.ID, err)
		}
		log.Printf("usuário %d migrado com nome %q", usuario.ID, nome)
	}

	var estabelecimentos []models.Estabelecimento
	if err := db.Find(&estabelecimentos).Error; err != nil {
		log.Fatalf("erro ao buscar estabelecimentos: %v", err)
	}
	for _, estabelecimento := range estabelecimentos {
		var pendentes int64
		db.Model(&models.Agendamento{}).
			Where("estabelecimento_id = ? AND profissional_id = 0", estabelecimento.ID).
			Count(&pendentes)
		if pendentes == 0 {
			continue
		}

		var dono models.Usuario
		err := db.Where("estabelecimento_id = ?", estabelecimento.ID).
			Order("id asc").
			First(&dono).Error
		if err != nil {
			log.Printf("aviso: estabelecimento %d tem agendamentos sem profissional e nenhum usuário — pulando", estabelecimento.ID)
			continue
		}

		err = db.Model(&models.Agendamento{}).
			Where("estabelecimento_id = ? AND profissional_id = 0", estabelecimento.ID).
			Update("profissional_id", dono.ID).Error
		if err != nil {
			log.Fatalf("erro ao migrar profissional_id do estabelecimento %d: %v", estabelecimento.ID, err)
		}
		log.Printf("agendamentos do estabelecimento %d migrados pro profissional %d", estabelecimento.ID, dono.ID)
	}
}
