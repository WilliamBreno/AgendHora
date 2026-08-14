package notifications

import (
	"fmt"
	"strings"

	"agendamento/backend/internal/models"
)

const corPrimaria = "#0C7C71"

func envelope(titulo, corpo string) string {
	return fmt.Sprintf(`<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
      <tr>
        <td style="background:%s;padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;">%s</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          %s
        </td>
      </tr>
    </table>
  </body>
</html>`, corPrimaria, titulo, corpo)
}

func linhaDetalhe(rotulo, valor string) string {
	return fmt.Sprintf(`<tr>
    <td style="padding:6px 0;color:#78716c;font-size:14px;">%s</td>
    <td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px;">%s</td>
  </tr>`, rotulo, valor)
}

func tabelaDetalhes(linhas ...string) string {
	html := `<table role="presentation" width="100%" style="margin-top:16px;border-top:1px solid #e7e5e4;padding-top:8px;">`
	for _, l := range linhas {
		html += l
	}
	html += `</table>`
	return html
}

func emailClienteHTML(estabelecimento models.Estabelecimento, agendamento models.Agendamento, dataFormatada string) string {
	corpo := fmt.Sprintf(
		`<p style="font-size:15px;margin:0 0 4px;">Olá, %s!</p>
		<p style="font-size:15px;margin:0 0 4px;color:#44403c;">Seu horário em <strong>%s</strong> foi confirmado.</p>`,
		agendamento.Cliente.Nome, estabelecimento.Nome,
	)
	corpo += tabelaDetalhes(
		linhaDetalhe("Serviço", agendamento.Servico.Nome),
		linhaDetalhe("Data", dataFormatada),
		linhaDetalhe("Horário", agendamento.Hora),
	)
	corpo += `<p style="font-size:13px;color:#78716c;margin-top:20px;">Precisa remarcar ou cancelar? É só entrar em contato diretamente com o estabelecimento.</p>`
	return envelope("Agendamento confirmado", corpo)
}

func emailDonoHTML(estabelecimento models.Estabelecimento, agendamento models.Agendamento, dataFormatada string) string {
	corpo := `<p style="font-size:15px;margin:0 0 4px;">Novo agendamento recebido:</p>`
	corpo += tabelaDetalhes(
		linhaDetalhe("Cliente", agendamento.Cliente.Nome),
		linhaDetalhe("Telefone", agendamento.Cliente.Telefone),
		linhaDetalhe("Serviço", agendamento.Servico.Nome),
		linhaDetalhe("Data", dataFormatada),
		linhaDetalhe("Horário", agendamento.Hora),
	)
	if agendamento.Observacoes != "" {
		corpo += fmt.Sprintf(`<p style="font-size:14px;color:#44403c;margin-top:16px;"><strong>Observações:</strong> %s</p>`, agendamento.Observacoes)
	}
	return envelope("Novo agendamento", corpo)
}

func emailConviteProfissionalHTML(estabelecimento models.Estabelecimento, link string) string {
	corpo := fmt.Sprintf(
		`<p style="font-size:15px;margin:0 0 4px;">Você foi convidado(a) para fazer parte da equipe de <strong>%s</strong> no AgendHora.</p>
		<p style="font-size:15px;margin:12px 0;color:#44403c;">Clique no botão abaixo pra criar sua senha e acessar sua própria agenda.</p>
		<p style="margin:20px 0;"><a href="%s" style="display:inline-block;background:%s;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Criar minha conta</a></p>
		<p style="font-size:12px;color:#a8a29e;margin-top:16px;word-break:break-all;">Ou acesse: %s</p>`,
		estabelecimento.Nome, link, corPrimaria, link,
	)
	return envelope("Convite para "+estabelecimento.Nome, corpo)
}

func emailLembreteHTML(estabelecimento models.Estabelecimento, agendamento models.Agendamento, dataFormatada string) string {
	corpo := fmt.Sprintf(
		`<p style="font-size:15px;margin:0 0 4px;">Olá, %s!</p>
		<p style="font-size:15px;margin:0 0 4px;color:#44403c;">Passando pra lembrar do seu horário em <strong>%s</strong> daqui a pouco.</p>`,
		agendamento.Cliente.Nome, estabelecimento.Nome,
	)
	corpo += tabelaDetalhes(
		linhaDetalhe("Serviço", agendamento.Servico.Nome),
		linhaDetalhe("Data", dataFormatada),
		linhaDetalhe("Horário", agendamento.Hora),
	)
	return envelope("Lembrete de agendamento", corpo)
}

func emailRenovacaoPendenteHTML(estabelecimento models.Estabelecimento, diasRestantes int, link string) string {
	var mensagemPrazo string
	switch {
	case diasRestantes < 0:
		mensagemPrazo = "sua assinatura do AgendHora <strong>venceu</strong> e o acesso foi pausado."
	case diasRestantes == 0:
		mensagemPrazo = "sua assinatura do AgendHora <strong>vence hoje</strong>."
	case diasRestantes == 1:
		mensagemPrazo = "sua assinatura do AgendHora <strong>vence amanhã</strong>."
	default:
		mensagemPrazo = fmt.Sprintf("sua assinatura do AgendHora <strong>vence em %d dias</strong>.", diasRestantes)
	}

	corpo := fmt.Sprintf(
		`<p style="font-size:15px;margin:0 0 4px;">Olá, %s!</p>
		<p style="font-size:15px;margin:12px 0;color:#44403c;">Passando pra avisar que %s</p>
		<p style="font-size:15px;margin:12px 0;color:#44403c;">Pra manter sua agenda e página de agendamento funcionando sem interrupção, renove por aqui:</p>
		<p style="margin:20px 0;"><a href="%s" style="display:inline-block;background:%s;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Renovar assinatura</a></p>
		<p style="font-size:12px;color:#a8a29e;margin-top:16px;word-break:break-all;">Ou acesse: %s</p>`,
		estabelecimento.Nome, mensagemPrazo, link, corPrimaria, link,
	)
	return envelope("Renovação da assinatura", corpo)
}

func formatarReaisEmail(valor float64) string {
	return "R$ " + strings.Replace(fmt.Sprintf("%.2f", valor), ".", ",", 1)
}

func emailResumoSemanalHTML(estabelecimento models.Estabelecimento, faturamento float64, quantidade int, sugestaoTitulo, sugestaoDescricao string, temSugestao bool) string {
	corpo := fmt.Sprintf(
		`<p style="font-size:15px;margin:0 0 4px;">Olá! Aqui está o resumo da semana passada em <strong>%s</strong>.</p>`,
		estabelecimento.Nome,
	)
	corpo += tabelaDetalhes(
		linhaDetalhe("Faturamento", formatarReaisEmail(faturamento)),
		linhaDetalhe("Agendamentos", fmt.Sprintf("%d", quantidade)),
	)
	if temSugestao {
		corpo += fmt.Sprintf(
			`<div style="margin-top:20px;padding:14px;background:#f5f5f4;border-radius:8px;">
				<p style="font-size:14px;font-weight:600;margin:0 0 4px;">%s</p>
				<p style="font-size:13px;color:#57534e;margin:0;">%s</p>
			</div>`,
			sugestaoTitulo, sugestaoDescricao,
		)
	}
	corpo += `<p style="font-size:13px;color:#78716c;margin-top:20px;">Quer ver mais detalhes? Entre no AgendHora e confira seu dashboard completo.</p>`
	return envelope("Resumo da semana", corpo)
}

func emailCancelamentoHTML(estabelecimento models.Estabelecimento, agendamento models.Agendamento, dataFormatada string) string {
	corpo := fmt.Sprintf(
		`<p style="font-size:15px;margin:0 0 4px;">Olá, %s.</p>
		<p style="font-size:15px;margin:0 0 4px;color:#44403c;">Seu horário em <strong>%s</strong> foi cancelado.</p>`,
		agendamento.Cliente.Nome, estabelecimento.Nome,
	)
	corpo += tabelaDetalhes(
		linhaDetalhe("Serviço", agendamento.Servico.Nome),
		linhaDetalhe("Data", dataFormatada),
		linhaDetalhe("Horário", agendamento.Hora),
	)
	return envelope("Agendamento cancelado", corpo)
}
