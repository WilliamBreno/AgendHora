# CLAUDE.md — Sistema de Agendamento

## Visão geral

Sistema de agendamento (booking) simples para estabelecimentos de serviço (ex: salão, barbearia, clínica de estética, studio). Dois lados:

- **Página pública**: o cliente final escolhe um serviço, vê horários disponíveis e agenda — sem precisar de login.
- **Área administrativa** (autenticada): o dono do estabelecimento vê todos os agendamentos numa agenda mensal, cadastra os serviços que oferece e recebe notificação de cada novo agendamento.

## Estrutura do repositório

```
/backend     → Go (API)
/frontend    → React + TypeScript + Vite
CLAUDE.md    → este arquivo
```

## Stack

- **Backend**: Go (Gin) + GORM + PostgreSQL
- **Frontend**: React 19 + TypeScript + Vite + Tailwind + shadcn/ui (Base UI, não Radix) + lucide-react
- **Animação**: GSAP para as transições da agenda (troca de mês, abertura do painel de detalhe, stagger de listas de agendamentos). Magic UI só em 1–2 pontos pontuais de destaque (ex: contador animado no dashboard), nunca no fluxo operacional principal — mantém a área admin rápida e limpa.
- **Notificações**: Resend (e-mail) e whatsmeow (WhatsApp) — mesmos serviços já usados no projeto Drenux; implementar como service layer própria deste projeto, não importar código do Drenux.

## Escopo desta primeira versão

**Decisão assumida**: mono-estabelecimento nesta v1 (diferente do Drenux, que é multi-tenant). O modelo de dados já guarda um registro `Estabelecimento` separado, para não travar uma evolução futura para multi-tenant/SaaS, mas a v1 não precisa resolver múltiplas contas, planos, nem onboarding de lojista. Se a intenção for outra, ajustar esta seção antes de começar.

## Modelo de dados

- **Estabelecimento**: nome, telefone, endereço (opcional), horário de funcionamento por dia da semana, `icones_padrao` (lista configurável de nomes de ícones lucide-react disponíveis no cadastro de serviço — ver seção "Ícones dos serviços")
- **Usuario** (admin): email, senha (hash), estabelecimento_id
- **Servico**: nome, preco, duracao_min, descricao, cor (chave de uma paleta fixa — ver abaixo), icone, estabelecimento_id
- **Agendamento**: cliente_nome, cliente_telefone, servico_id, data, hora, status (`pendente` | `confirmado` | `cancelado`), observacoes, estabelecimento_id

Cliente não precisa de tabela própria na v1 — nome e telefone ficam direto no Agendamento. Reavaliar isso se precisar de histórico por cliente no futuro (ex: "cliente já veio antes").

## Paleta e tipografia

Já validadas com o dono do projeto num protótipo — reaproveitar exatamente:

- Cor principal (ações, marca): `#0C7C71`
- Paleta de identificação por serviço (fixa, 6 opções, uma por serviço): teal `#0C7C71`, coral `#E1614A`, violeta `#7C6FC4`, âmbar `#D69A34`, verde-sálvia `#5A9367`, rosa `#C4638A`
- Tipografia: Space Grotesk (títulos, números, preços) + Plus Jakarta Sans (texto corrido, labels)
- Fundo neutro em tons de stone (Tailwind), cards brancos, bordas `stone-200`

## Funcionalidades

## Fluxo de confirmação do agendamento

Dúvida resolvida: **ninguém precisa confirmar manualmente** no fluxo padrão. O próprio ato de o cliente preencher e enviar o formulário na página pública já cria o agendamento como `confirmado` — a notificação que ele recebe por e-mail/WhatsApp é só o aviso de que o horário foi reservado com sucesso, não um pedido de ação da parte dele.

- `confirmado`: estado padrão ao criar o agendamento (self-service, sem aprovação do dono)
- `cancelado`: qualquer uma das partes pode cancelar depois — cliente por um link na própria mensagem de confirmação, dono pelo painel admin
- `pendente` deixa de ser obrigatório no fluxo padrão, mas o valor continua no enum pra uma função futura opcional: um interruptor em Configurações do tipo "aprovar agendamentos manualmente", que faria o agendamento nascer `pendente` até o dono aceitar. Não construir essa tela nesta v1 — só deixar o campo pronto pra não exigir migration depois.

(Se a ideia original era o dono revisar cada agendamento antes de confirmar, é só avisar que esse padrão se inverte.)

### 1. Página pública de agendamento (cliente final)
- Lista os serviços em cards coloridos (sem necessidade de login)
- Ao escolher um serviço: seletor de data + horários livres daquele dia, calculando disponibilidade a partir da duração do serviço, do horário de funcionamento do estabelecimento e dos agendamentos já existentes
- Formulário: nome, telefone, observações (opcional)
- Ao confirmar: cria o Agendamento já como `confirmado` (ver "Fluxo de confirmação do agendamento" acima), dispara notificação de confirmação pro cliente e notificação pro dono

### 2. Área administrativa (autenticada)
- Login simples (email + senha, JWT)
- **Cabeçalho da agenda**: mostra o mês e o ano (ex: "Julho de 2026"); quando o mês exibido é o mês atual, mostrar também o dia de hoje por extenso (ex: "Hoje é sexta-feira, dia 24"); cada linha da grade (semana) leva um rótulo indicando a semana do mês (Semana 1, Semana 2, Semana 3...) — hoje o protótipo só mostra mês e ano, sem esse detalhe
- **Agenda mensal**: grade do mês, navegação entre meses, dia atual destacado, cada agendamento como pílula colorida (cor = cor do serviço); dias com muitos agendamentos mostram "+N mais"
- Clicar num agendamento abre um **painel lateral** com: cliente (nome, telefone), serviço, data/hora, duração, preço, status, observações
- Ação de cancelar um agendamento direto no painel de detalhe (e de aceitar/recusar, só se o modo opcional de aprovação manual — ver seção de fluxo de confirmação — estiver ativado)
- **Cadastro de serviços**: listagem em cards com barra de cor lateral; criar/editar/excluir; campos nome, preço, duração, descrição, cor (paleta fixa de 6) e ícone

### 3. Notificações
- Cliente: e-mail (Resend) e/ou WhatsApp (whatsmeow) de confirmação assim que agenda
- Dono: notificação a cada novo agendamento (mesmo canal, ou indicador simples dentro do admin)

### 4. Dashboard (visão geral do estabelecimento)
- Cards de resumo com métricas de hoje, da semana e do mês: nº de agendamentos confirmados, faturamento (soma dos preços dos serviços agendados no período) e nº de agendamentos que ainda vão acontecer no período (hoje, na semana, no mês)
- Gráfico de faturamento ao longo do tempo (últimos 7 e últimos 30 dias) — recharts
- Ranking simples dos serviços mais agendados e dos que mais faturam no período
- **Motor de sugestões de faturamento**, baseado inteiramente em dados reais do estabelecimento (sem IA generativa — regras determinísticas sobre o próprio histórico de agendamentos). Gera no máximo 2–3 cartões por vez, sempre com um número real por trás, nunca um valor genérico:
  - Se a ocupação de horários estiver baixa num dia ou período específico (vagos vs. preenchidos, dado o horário de funcionamento): sugerir preencher aqueles horários, com a projeção de quanto isso renderia usando o ticket médio real do estabelecimento
  - Se o faturamento estiver caindo de um período pro outro (semana vs. semana passada, mês vs. mês passado): apontar em qual dia da semana a queda é maior
  - Se já estiver indo bem (ocupação alta, faturamento estável ou crescendo): trocar o tom de alerta por incentivo — mostrar o teto real de faturamento se a ocupação chegasse a 100%, ou quanto o ritmo atual projeta pro fim do mês
  - Regra importante: nunca mostrar sugestão de "melhorar" quando já está indo bem. Nesse caso, mostrar só o potencial de ganho mais alto, como reforço positivo — não deve soar como cobrança

## Ferramentas no dashboard

Esta é a tela onde mais faz sentido usar bibliotecas de efeito visual (nas outras telas do admin, o critério foi restraint):

- **recharts** — já disponível no mesmo stack do protótipo; usar pro gráfico de faturamento (linha ou barra, simples)
- **Magic UI** — aqui vale usar mais do que só em marketing: `NumberTicker` pra animar os números dos cards de resumo (faturamento, agendamentos) e algo como um progress ring pra ocupação de horários. Ainda com moderação: um destaque por card, sem empilhar efeito em cima de efeito
- **GSAP** — stagger na entrada dos cards de sugestão e do gráfico quando o dashboard carrega
- three.js e anime.js — mesma conclusão de antes, sem uso real aqui

## Referência visual

Existe um protótipo funcional em React (`agenda-estabelecimento.jsx`, entregue junto com este arquivo) já validado com o usuário — cobre a agenda mensal, o painel de detalhe e o cadastro de serviços. Usar como referência de **comportamento e hierarquia visual**, não como código final: ele usa Tailwind solto, sem shadcn de fato, e as animações são feitas em CSS (no projeto real, essas mesmas transições devem ser implementadas com GSAP).

## Ícones dos serviços

Dois pontos a construir (escopo confirmado, não é mais só uma pendência):

1. **Seletor de ícone no formulário de serviço**: grade de ícones pra escolher, do mesmo jeito que já existe o seletor de cor.
2. **Tela de configuração dos ícones padrão** (em Configurações): o dono deve poder definir quais ícones ficam disponíveis nesse seletor — não é uma lista fixa no código do frontend. Guardar em `Estabelecimento.icones_padrao` (lista de nomes de ícones lucide-react); uma tela simples permite adicionar/remover ícones desse conjunto. O seletor do formulário de serviço sempre lê dessa lista, nunca de um array hardcoded.

No protótipo visual que já existe, os ícones dos serviços de exemplo foram escolhidos manualmente, um por um, direto no código, sem seletor nem tela de configuração — serve só de referência do visual dos cards, não da funcionalidade em si.

## Fases sugeridas

1. Setup do repositório (backend Go + frontend Vite), banco de dados e migrations
2. Modelo + CRUD de Servico (API e tela admin)
3. CRUD de Agendamento + agenda mensal no admin (ainda sem notificação)
4. Página pública de agendamento + cálculo de disponibilidade de horários
5. Notificações (e-mail e WhatsApp)
6. Autenticação do admin + deploy
7. Dashboard: métricas agregadas (agendamentos e faturamento por dia/semana/mês) + motor de sugestões

## Decisões que não mudar sem repensar

- Cores de serviço vêm de uma paleta fixa de 6, não são livres — é o que mantém a agenda organizada e legível
- Cliente final nunca precisa de login pra agendar
- v1 é mono-estabelecimento; virar multi-tenant é uma decisão de arquitetura separada, não um incremento simples
- Agendamento nasce `confirmado` por padrão (self-service); aprovação manual do dono é um interruptor opcional futuro, não o comportamento padrão
- Ícones disponíveis no cadastro de serviço vêm de uma lista configurável pelo dono (`icones_padrao`), não de um array fixo no código
- Sugestões do dashboard vêm de regras determinísticas sobre dados reais do próprio estabelecimento, não de IA generativa — mantém previsível, explicável e sem custo de API
