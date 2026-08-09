package database

import (
	"log"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"agendamento/backend/internal/models"
	"agendamento/backend/internal/slug"
)

// apenasDigitosMigracao normaliza telefone pra comparação — cópia local da
// mesma lógica de handlers.apenasDigitos (esse pacote não pode importar
// handlers, e é pouco código pra justificar um pacote utilitário à parte).
func apenasDigitosMigracao(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

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

// agendamentoClienteLegado lê só as colunas antigas de cliente_nome/
// cliente_telefone/cliente_email — que continuam fisicamente na tabela
// (AutoMigrate nunca apaga coluna), mas saíram do model Agendamento.
type agendamentoClienteLegado struct {
	ID                uint
	ClienteNome       string
	ClienteTelefone   string
	ClienteEmail      string
	EstabelecimentoID uint
}

// colunaExiste confere no catálogo do Postgres se uma coluna ainda existe —
// necessário aqui porque esta migration lê colunas legadas via SQL cru
// (fora do model), então, ao contrário de db.Migrator().HasColumn, precisa
// funcionar mesmo depois delas já terem sido apagadas numa rodada anterior.
func colunaExiste(db *gorm.DB, tabela, coluna string) bool {
	var existe bool
	db.Raw(
		`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?)`,
		tabela, coluna,
	).Scan(&existe)
	return existe
}

// MigrarClientes cria a entidade Cliente a partir dos dados que já estavam
// soltos em cada Agendamento (cliente_nome/cliente_telefone/cliente_email),
// casando por telefone dentro do mesmo estabelecimento — sem perder nenhum
// dado existente. Roda uma vez só: agendamentos novos já nascem com
// cliente_id preenchido (ver handlers.encontrarOuCriarCliente). Depois da
// primeira vez as colunas legadas somem (ver DROP no final), então todo
// boot seguinte já sai fora por aqui, sem tentar ler coluna que não existe
// mais.
func MigrarClientes(db *gorm.DB) {
	if !colunaExiste(db, "agendamentos", "cliente_nome") {
		return
	}

	var legados []agendamentoClienteLegado
	err := db.Raw(`
		SELECT id, cliente_nome, cliente_telefone, cliente_email, estabelecimento_id
		FROM agendamentos
		WHERE cliente_id = 0 OR cliente_id IS NULL
	`).Scan(&legados).Error
	if err != nil {
		log.Fatalf("erro ao buscar agendamentos sem cliente: %v", err)
	}

	// cache em memória pra não repetir a busca de cliente a cada agendamento
	// do mesmo telefone dentro da mesma leva de migração.
	clientesPorChave := map[string]uint{}

	for _, ag := range legados {
		telefoneNormalizado := apenasDigitosMigracao(ag.ClienteTelefone)
		chave := chaveCliente(ag.EstabelecimentoID, telefoneNormalizado)

		clienteID, existe := clientesPorChave[chave]
		if !existe {
			var cliente models.Cliente
			err := db.Where(
				"estabelecimento_id = ? AND regexp_replace(telefone, '[^0-9]', '', 'g') = ?",
				ag.EstabelecimentoID, telefoneNormalizado,
			).First(&cliente).Error
			if err == gorm.ErrRecordNotFound {
				cliente = models.Cliente{
					Nome:              ag.ClienteNome,
					Telefone:          ag.ClienteTelefone,
					Email:             ag.ClienteEmail,
					EstabelecimentoID: ag.EstabelecimentoID,
				}
				if err := db.Create(&cliente).Error; err != nil {
					log.Fatalf("erro ao criar cliente pro agendamento %d: %v", ag.ID, err)
				}
			} else if err != nil {
				log.Fatalf("erro ao buscar cliente pro agendamento %d: %v", ag.ID, err)
			}
			clienteID = cliente.ID
			clientesPorChave[chave] = clienteID
		}

		if err := db.Model(&models.Agendamento{}).Where("id = ?", ag.ID).Update("cliente_id", clienteID).Error; err != nil {
			log.Fatalf("erro ao migrar cliente_id do agendamento %d: %v", ag.ID, err)
		}
	}

	if len(legados) > 0 {
		log.Printf("%d agendamento(s) migrados para %d cliente(s) distintos", len(legados), len(clientesPorChave))
	}

	// as colunas antigas continuavam NOT NULL no banco (herdado de quando
	// ainda faziam parte do model) — como o código não escreve mais nelas,
	// isso quebraria todo INSERT novo em agendamentos. Só derruba depois do
	// backfill acima já ter copiado os dados pra Cliente; idempotente (IF
	// EXISTS), então rodar de novo em deploys futuros não faz nada.
	for _, coluna := range []string{"cliente_nome", "cliente_telefone", "cliente_email"} {
		if err := db.Exec(`ALTER TABLE agendamentos DROP COLUMN IF EXISTS ` + coluna).Error; err != nil {
			log.Fatalf("erro ao remover coluna legada %s: %v", coluna, err)
		}
	}
}

func chaveCliente(estabelecimentoID uint, telefoneNormalizado string) string {
	return strconv.FormatUint(uint64(estabelecimentoID), 10) + "|" + telefoneNormalizado
}
