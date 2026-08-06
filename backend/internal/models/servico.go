package models

import "time"

// CoresServico é a paleta fixa de 6 cores disponíveis para identificar um serviço.
// Não são livres: isso é o que mantém a agenda organizada e legível (ver CLAUDE.md).
var CoresServico = []string{
	"teal",         // #0C7C71
	"coral",        // #E1614A
	"violeta",      // #7C6FC4
	"ambar",        // #D69A34
	"verde-salvia", // #5A9367
	"rosa",         // #C4638A
}

// Servico é um serviço oferecido pelo estabelecimento (ex: corte, manicure, massagem).
type Servico struct {
	ID    uint    `gorm:"primaryKey" json:"id"`
	Nome  string  `gorm:"not null" json:"nome"`
	Preco float64 `gorm:"not null" json:"preco"`
	// PrecoAPartir marca o preço como uma estimativa mínima ("a partir de
	// R$X"), pra serviços cujo valor final varia (ex: depende do cabelo,
	// do procedimento escolhido na hora etc).
	PrecoAPartir bool   `gorm:"not null;default:false" json:"preco_a_partir"`
	DuracaoMin   int    `gorm:"not null" json:"duracao_min"`
	Descricao    string `json:"descricao"`
	Cor          string `gorm:"not null" json:"cor"`
	Icone        string `json:"icone"`
	// Foto é opcional — uma imagem de exemplo do serviço, como data URI
	// base64, mostrada pro cliente final na página pública.
	Foto              string `json:"foto"`
	EstabelecimentoID uint   `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
