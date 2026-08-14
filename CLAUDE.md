# CLAUDE.md — Sistema de Agendamento

> **Nota de sincronização**: este arquivo já passou por várias revisões numa conversa fora deste repositório. Antes de implementar qualquer item novo, confirme no código real (não só neste arquivo) o status de: **multi-tenant** (o backend/banco já é compartilhado entre múltiplos Estabelecimento, ou ainda é um deploy por cliente?) — essa resposta muda a prioridade do que vem a seguir. O item "Profissionais" já foi corrigido nesta versão a partir do que o código real mostrou (ver seção própria).

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
- **Notificações**: Resend (e-mail) por enquanto — mesmo serviço já usado no projeto Drenux, implementar como service layer própria deste projeto, não importar código do Drenux. WhatsApp (whatsmeow) fica pra depois, ver "Decisões que não mudar sem repensar"

## Escopo desta primeira versão

**Decisão revista**: o sistema é **multi-tenant desde a v1** — um backend e um banco só, compartilhados entre todos os estabelecimentos, do mesmo jeito que o Drenux já funciona. A decisão original (mono-estabelecimento, um backend por cliente) foi abandonada porque não fecha a conta com o preço de R$19,90/mês definido abaixo: hospedar um backend pago separado por cliente custa mais que a própria mensalidade dele. Com um backend só compartilhado, o custo de servidor não multiplica por cliente novo — é o que torna R$19,90/mês viável em escala.

Isso não é um recomeço: o modelo de dados abaixo já guardava `estabelecimento_id` em cada tabela desde o início (decisão tomada de propósito, pra não travar essa evolução) — então virar multi-tenant agora é sobretudo uma questão de deploy (um serviço só) e de garantir que toda consulta ao banco filtra por `estabelecimento_id`, não uma reestruturação grande do modelo.

## Modelo de negócio e preço

- Plano único por enquanto: **R$19,90/mês**, tudo incluso (confirmado — toda a lista de funcionalidades do sistema entra nesse valor, sem trava por tier, sem comissão sobre o faturamento do estabelecimento)
- Quando fizer sentido criar planos adicionais, a alavanca mais natural pra diferenciá-los é **quantidade de profissionais/auxiliares** (hoje sem limite) — não outras funcionalidades, já que nada da lista atual custa infraestrutura extra por cliente. Ainda não decidido quando/como; só fica registrado como o caminho mais óbvio pra quando chegar a hora
- Posicionamento: bem abaixo dos concorrentes diretos do nicho (Trinks começa em R$65-89/mês, funcionalidade essencial só a partir de R$149-249/mês; Belezzia começa em R$199/mês) — o público-alvo é o profissional autônomo ou estabelecimento pequeno pra quem essas ferramentas são caras ou complexas demais
- **Cobrança revista**: automática via InfinitePay (Checkout Integrado) — link de pagamento único por cadastro, confirmado por webhook, ativa o Estabelecimento sozinho (ver "Cadastro e ativação de novos estabelecimentos"). Deixou de ser manual/Pix-fixo; `Estabelecimento.ativo` continua existindo, só que agora é o webhook que atualiza ele, não uma pessoa
- **Decisão fechada sobre o bloqueio**: quando `ativo = false`, tudo fica indisponível — admin (login bloqueado, ou sessão existente expulsa) e página pública de agendamento (mostra uma mensagem simples de indisponível, não erro técnico). Isso ainda não foi implementado — é uma feature real a construir, não só o campo existir no banco
- Planos futuros com mais funcionalidades estão previstos, mas não fazem parte do escopo agora — por isso o campo `Estabelecimento.plano` (string, hoje sempre `"padrao"`) já existe no modelo, pra não exigir migration de dado quando os outros planos forem definidos

## Modelo de dados

- **Estabelecimento**: nome, `slug` (identifica a URL pública do estabelecimento), telefone, endereço (opcional), horário de funcionamento por dia da semana, `plano` (string, hoje sempre `"padrao"`), `ativo` (booleano, controla acesso enquanto a cobrança é manual), `isento` (booleano, separado de `ativo` — marca quem nunca deve ser cobrado, ver "Isenção de pagamento"), `proximo_vencimento` (data, ver "Renovação mensal"), `segmento` (string, padrão `"geral"` — ver "Segmentos de negócio"), `icones_padrao`
- **EmailIsento**: email (normalizado), estabelecimento_id (nulo até ser usado), criado_em — não pertence a nenhum estabelecimento, é uma lista global gerenciada só pelo dono do projeto (lista configurável de nomes de ícones lucide-react disponíveis no cadastro de serviço — ver seção "Ícones dos serviços")
- **Usuario** (login): email, senha (hash), `papel` (`dono` | `auxiliar`), horário de trabalho, estabelecimento_id — auxiliares são convidados por e-mail e viram "profissionais" com login e agenda próprios (confirmado já implementado no código real; não criar uma tabela `Profissional` separada)
- **Servico**: nome, preco (opcional — ver "Segmentos de negócio"), duracao_min, descricao, cor (chave de uma paleta fixa — ver abaixo), icone, estabelecimento_id
- **Cliente**: nome, telefone (identifica o cliente dentro do estabelecimento), `data_nascimento` (opcional), estabelecimento_id — criado/atualizado automaticamente a cada novo agendamento, sem precisar de cadastro manual separado
- **Agendamento**: cliente_id, servico_id, profissional_id (referencia `Usuario`, não uma tabela `Profissional` separada), data, hora, status (`pendente` | `confirmado` | `cancelado`), pago (booleano), `valor_final` (opcional, sobrescreve o preço do serviço no faturamento), `valor_sinal` (opcional) + `sinal_pago` (booleano), `link_referencia` (opcional), `concluido_em` (data/hora, opcional — ver "Encaixe de horários"), observacoes, estabelecimento_id
- **Bloqueio**: data, hora_inicio, hora_fim (nulo = dia inteiro), motivo (opcional), profissional_id (nulo = bloqueia o estabelecimento inteiro), estabelecimento_id — usado pra folga, almoço, férias etc.; entra no mesmo cálculo de disponibilidade que já existe pros agendamentos, não é um sistema separado

Como o sistema é multi-tenant, **toda consulta ao banco precisa filtrar por `estabelecimento_id`** (vindo do JWT do admin logado, ou do estabelecimento selecionado na página pública) — nunca listar ou buscar sem esse filtro. Vale considerar um middleware que injeta esse filtro automaticamente, pra não depender de lembrar disso em cada rota nova.

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
- Cada estabelecimento tem sua própria URL pública (ex: `/agendar/nome-do-estabelecimento`, via um campo `slug` no Estabelecimento) — é assim que o sistema sabe qual estabelecimento está sendo agendado, já que agora vários dividem o mesmo backend
- Lista os serviços em cards coloridos (sem necessidade de login)
- Ao escolher um serviço: se o estabelecimento tem mais de um profissional ativo, mostra um passo extra pra escolher com quem (senão pula direto, sem perguntar); depois, seletor de data + horários livres daquele dia, calculando disponibilidade a partir da duração do serviço, do horário de funcionamento, dos Agendamentos e dos Bloqueios já existentes
- Formulário: nome, telefone, observações (opcional)
- Ao confirmar: cria o Agendamento já como `confirmado` (ver "Fluxo de confirmação do agendamento" acima), dispara notificação de confirmação pro cliente e notificação pro dono

### 2. Área administrativa (autenticada)
- Login simples (email + senha, JWT)
- **Cabeçalho da agenda**: mostra o mês e o ano (ex: "Julho de 2026"); quando o mês exibido é o mês atual, mostrar também o dia de hoje por extenso (ex: "Hoje é sexta-feira, dia 24"); cada linha da grade (semana) leva um rótulo indicando a semana do mês (Semana 1, Semana 2, Semana 3...) — hoje o protótipo só mostra mês e ano, sem esse detalhe
- **Agenda com três visões — mensal, semanal e diária** (alternável): grade do mês (a que já existe no protótipo), navegação entre meses/semanas/dias, dia atual destacado, cada agendamento como pílula colorida (cor = cor do serviço); dias com muitos agendamentos mostram "+N mais". Semanal e diária são visões novas, reaproveitando os mesmos componentes de pílula e painel de detalhe já validados
- **Filtro de profissional na agenda com multi-seleção** (ver vários ou todos ao mesmo tempo) — **só visível pra quem tem `papel = dono`**; um auxiliar (`papel = auxiliar`) não vê esse controle, só a própria agenda, já que não faz sentido ele escolher ver outros profissionais
- Clicar num agendamento abre um **painel lateral** com: cliente (nome, telefone), profissional responsável, serviço, data/hora, duração, preço, status, se já está pago, observações
- Ações no painel de detalhe: cancelar, reagendar (ver seção "Bloqueio de horários e reagendamento"), marcar como pago, e aceitar/recusar só se o modo opcional de aprovação manual estiver ativado
- **Cadastro de serviços**: listagem em cards com barra de cor lateral; criar/editar/excluir; campos nome, preço, duração, descrição, cor (paleta fixa de 6) e ícone

### 3. Notificações
- **Só e-mail por enquanto (Resend)** — confirmação pro cliente assim que agenda, e aviso pro dono a cada novo agendamento. WhatsApp (whatsmeow) fica de fora deste momento por decisão do dono do projeto — ver "Decisões que não mudar sem repensar"

### 4. Dashboard (visão geral do estabelecimento)
- **Dropdown de profissional com multi-seleção** (ver todos ou alguns) filtrando todas as métricas abaixo — mesma regra da agenda: **só visível pro dono**; auxiliar vê só os próprios números, sem esse controle
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

## Profissionais

**Correção importante (confirmada pelo Claude Code direto no código real): isso já está construído, e de um jeito melhor do que a proposta original desta seção.** Não existe uma entidade `Profissional` simples — profissional é o próprio `Usuario` que faz login, com um campo `Papel` (`dono` | `auxiliar`). Cadastrar um profissional novo hoje é convidar por e-mail: a pessoa recebe um link, cria a própria senha, ganha login e vê a própria agenda. `Agendamento.ProfissionalID` já existe e já aponta pra esse `Usuario`, com horário de trabalho próprio e disponibilidade pública considerando seleção de profissional quando há mais de um.

- Não criar a tabela `Profissional` separada — é redundante com `Usuario`/`Papel`, que já resolve isso e já está em uso pelo fluxo inteiro (convite, agenda própria, disponibilidade)
- O comportamento de "só mostrar seletor de profissional na página pública quando há mais de um ativo" já parece estar implementado (Claude Code mencionou "disponibilidade pública com seleção de profissional") — confirmar antes de mexer, não reconstruir
- Segue sem limite de quantidade de auxiliares por enquanto, mesma lógica de antes (só um plano, tudo incluso)

## Clientes

- Tela simples em admin listando os clientes já atendidos (nome, telefone, data de nascimento se cadastrada, quantos agendamentos já fez) — vem de graça a partir da tabela `Cliente` nova, sem cadastro manual: todo agendamento novo cria ou atualiza o registro do cliente automaticamente, casando por telefone dentro do mesmo estabelecimento
- **Cadastro manual**: formulário simples pra adicionar ou editar um cliente direto — nome, telefone (com máscara de telefone brasileiro), data de nascimento (seletor de data de verdade, não campo de texto livre — evita data digitada errada)
- **Importação em lote**: dois formatos, os dois funcionam igual em qualquer celular (Android ou iPhone) — CSV (planilha) e .vcf (arquivo de contatos exportado nativamente do celular). Cada linha/contato vira um `Cliente`; se o arquivo trouxer data de nascimento, importa também
- **Aniversariantes**: filtro simples na tela de Clientes pra ver quem faz aniversário no mês (ou na semana) — usa o campo `data_nascimento`
- **Clientes sumidos**: sinalização automática na tela de Clientes de quem não agenda há muito tempo (padrão 60 dias, calculado a partir do último agendamento) — aparece sozinho, sem o dono precisar lembrar de checar; o contato em si continua manual, mesma lógica do aniversário
- **Envio de comunicado de aniversário é manual nesta v1** — o sistema mostra a lista e os dados de contato, mas quem manda a mensagem é o próprio dono, pelo canal que preferir; não é um disparo automático (isso juntaria duas decisões já tomadas: WhatsApp fica de fora por enquanto, e não existe motor de campanha/marketing nesta v1). Se um dia fizer sentido automatizar, é o mesmo padrão dos lembretes por e-mail — mas fica documentado como decisão consciente de não fazer agora, não esquecimento
- "Cadastro ilimitado de clientes" do comparativo não é uma funcionalidade a construir à parte — é uma consequência de não ter nenhum limite artificial nessa tabela, o que já é o caso por padrão

## Encaixe de horários

Os dois caminhos discutidos (aviso ao criar manualmente, e conclusão antecipada) não são dois sistemas separados — são a mesma conta de disponibilidade, só que o segundo alimenta ela com dado real quando existe.

- **`Agendamento` ganha o campo `concluido_em`** (data/hora, opcional, nulo por padrão)
- **Botão "Concluir agora"** no painel de detalhe de qualquer agendamento confirmado (dono ou auxiliar, no próprio) — registra `concluido_em` com o horário atual
- **A conta de "horário ocupado" de um profissional num dia passa a considerar**: se um Agendamento tem `concluido_em` preenchido e ele for antes do fim oficial (`hora + duracao`), o intervalo ocupado por aquele atendimento vira `[hora_inicio, concluido_em)` em vez do fim oficial — o resto do tempo já entra como livre de verdade
- **Essa mesma conta é usada em dois lugares, com comportamento diferente**:
  - **Página pública**: continua sempre conservadora e bloqueante — nunca mostra nem aceita um horário que a conta considere ocupado. Isso não muda mesmo com `concluido_em` existindo; é uma simplicidade proposital, não uma limitação técnica (evita o profissional ser encaixado no minuto seguinte a concluir algo, sem nenhuma folga)
  - **Admin** (criar/editar agendamento manualmente): a conta é só um aviso, nunca bloqueia. Se o horário escolhido cair num intervalo que a conta considera ocupado, mostra "Esse horário conflita com [Cliente — Serviço, HH:MM–HH:MM]. Confirmar mesmo assim?" com opção de confirmar. **Se `concluido_em` já tiver sido registrado pra aquele agendamento anterior, o aviso nem aparece** — o sistema já sabe que aquele intervalo está genuinamente livre
- Efeito prático: quem usa o botão "Concluir agora" ganha encaixes sem aviso nenhum (Caminho B); quem esquece de clicar continua funcionando do mesmo jeito de sempre, só vendo o aviso e confirmando na mão (Caminho A) — nenhum dos dois é obrigatório, o sistema funciona no primeiro dia mesmo que ninguém nunca clique em "Concluir agora"

## Bloqueio de horários e reagendamento

- **Bloqueio de horários**: tela simples pro dono marcar um período como indisponível (folga, almoço, feriado) — usa a entidade `Bloqueio` já descrita no modelo de dados. O cálculo de horários livres da página pública passa a considerar Bloqueio junto com os Agendamentos já existentes, como mais uma fonte de "horário ocupado"
- **Reagendamento**: novo botão "Reagendar" no painel de detalhe do agendamento (admin) — abre o mesmo seletor de data/horário da página pública, mantendo cliente e serviço, só troca data/hora do registro existente (não cria um novo)

## Financeiro simples e relatórios

- Cada agendamento ganha um campo `pago` (booleano) — marcável direto no painel de detalhe, ao lado do status
- Dashboard passa a separar "recebido" de "a receber" dentro do faturamento do período, usando esse campo
- Relatório básico: exportar os agendamentos do período selecionado no dashboard (data, cliente, serviço, valor, pago ou não) em três formatos — **CSV**, **XLSX** (planilha formatada, via `excelize`) e **PDF** (resumo tabular com totais, pronto pra imprimir ou enviar; não reproduz os gráficos do dashboard, só a lista + totais, via alguma lib tipo `go-pdf/fpdf`) — não é uma tela nova, é uma ação em cima dos dados que o dashboard já calcula

## Lembretes automáticos

- Envio de e-mail (Resend) algumas horas antes do horário marcado, lembrando o cliente do agendamento — **só e-mail por enquanto**, sem WhatsApp (ver decisão abaixo)
- Precisa de uma tarefa agendada (cron) rodando diariamente/de hora em hora pra verificar quais agendamentos estão próximos e ainda não receberam lembrete — é a primeira peça de infraestrutura do projeto que não é só "responder a um pedido HTTP", vale planejar como um serviço/rotina separada do resto da API
- **Resumo semanal por e-mail pro dono**: toda segunda-feira, e-mail automático com o resumo da semana anterior — faturamento, número de agendamentos, e a sugestão do dashboard daquele momento. Objetivo é o dono saber como foi a semana sem precisar abrir o sistema. Mesma infraestrutura de cron dos lembretes, só um gatilho semanal em vez de diário

## Cadastro e ativação de novos estabelecimentos

Peça que faltava por completo — tudo no resto do documento assume que o `Estabelecimento` já existe no banco; isso aqui é o caminho pra alguém novo chegar e virar cliente.

Estrutura de URLs proposta: `/` (marketing pública), `/cadastro` (formulário), `/agendar/:slug` (página pública de cada estabelecimento, já descrita antes), `/admin` (login e painel).

1. **Página de marketing** (`/`): explica o produto, mostra o preço (R$19,90/mês, tudo incluso) e tem um CTA de cadastro
2. **Cadastro** (`/cadastro`): nome do estabelecimento (gera `slug` automaticamente, checando disponibilidade), e-mail, senha, telefone — cria `Usuario` (`papel = dono`) + `Estabelecimento` com `ativo = false` por padrão
3. **Tela pós-cadastro**: em vez de mostrar uma chave Pix fixa, o backend chama `POST https://api.checkout.infinitepay.io/links` com o corpo:
   ```json
   {
     "handle": "william-breno-santos",
     "items": [{ "quantity": 1, "price": 1990, "description": "AgendHora - Assinatura mensal" }],
     "order_nsu": "<identificador do estabelecimento/ciclo>",
     "redirect_url": "<URL de volta pro AgendHora após pagar>",
     "webhook_url": "<URL do webhook do backend>"
   }
   ```
   **Atenção**: `price` é em **centavos**, não em reais — R$19,90 é `1990`. A resposta traz o link de checkout, mostrado nessa tela pra pessoa pagar (Pix, grátis, ou cartão)
4. **Ativação automática via webhook**: a InfinitePay chama `webhook_url` (a rota `POST /webhooks/infinitepay` do backend, pública) quando o pagamento é aprovado, com `order_nsu` no corpo. **Responder em menos de 1 segundo** com `200 OK` (sucesso) — responder `400 Bad Request` faz a InfinitePay tentar reenviar. O backend acha o Estabelecimento pelo `order_nsu` e marca `ativo = true` automaticamente
5. **Fallback**: um botão "já paguei, verificar" na própria tela, que chama `POST https://api.checkout.infinitepay.io/payment_check` como segunda checagem, caso o webhook atrase ou falhe
5.1. **Redirect opcional pra melhorar a UX**: configurar `redirect_url` fazendo o cliente voltar pro AgendHora depois de pagar (em vez de ficar preso na tela da InfinitePay) — a URL de volta chega com `order_nsu`, `slug`, `capture_method` (`pix` ou `credit_card`) e `transaction_nsu` como parâmetros, úteis pra já mostrar "pagamento recebido" sem esperar o webhook
6. **Só entra nesse fluxo quem não está isento** — e-mails da lista `EmailIsento` continuam pulando o pagamento inteiro, nunca chegam a gerar link de cobrança
7. Depois de ativo, login normal no `/admin`, sem nada especial

**Confirmado direto no painel da InfinitePay (aba Configurações do Checkout Integrado): não existe Bearer Token nenhum pra gerar.** A identificação é só pelo `handle` no corpo da requisição — não tem o que confirmar além disso. As únicas configurações lá são: habilitar o Checkout Integrado (já ligado), uma etapa de endereço do cliente, e meios de pagamento (Cartão e Pix).

**Ajuste recomendado antes de ir pra produção**: desligar a "Etapa de endereço" nas Configurações do Checkout Integrado — é pensada pra quem vende produto físico (pra onde enviar); pra uma assinatura digital como o AgendHora, só adiciona fricção sem necessidade nenhuma no meio do pagamento.

**Credenciais**: `handle` da InfinitePay (`william-breno-santos`, é a InfiniteTag, sem o símbolo `$`) vai em variável de ambiente no backend — é a única credencial necessária pra essa integração.



**Avaliado e descartado**: a InfinitePay tem uma área nativa de "Planos e assinaturas" com cobrança recorrente automática. Não serve pro nosso caso por dois motivos confirmados direto no painel: (1) adicionar assinante é um fluxo manual no painel deles, sem API/documentação encontrada — quebraria a automação; (2) a cobrança é numa data fixa de calendário compartilhada por todo o plano (ex: "todo dia 14"), não 30 dias a partir do pagamento de cada assinante, que é a regra já decidida aqui. Manter o Checkout Integrado (link individual + `order_nsu` por cadastro) como o mecanismo real.

## Renovação mensal

Resolve o que antes ficava em aberto: o que acontece depois do primeiro pagamento.

- **`Estabelecimento` ganha o campo `proximo_vencimento`** (data). A cada pagamento confirmado pelo webhook (inicial ou renovação), atualiza pra `data do pagamento + 30 dias` — assim quem paga atrasado não perde dias, sempre leva 30 dias completos por pagamento (em vez de uma data fixa tipo "sempre todo dia 14", que é mais rígida e não traz benefício real no volume atual)
- **Rotina diária** (mesma infraestrutura de cron já prevista pros lembretes de agendamento), com duas checagens:
  - Estabelecimentos com `proximo_vencimento` a poucos dias (ex: 3) e sem link de renovação já gerado → gera um novo link único via InfinitePay pro próximo ciclo (`order_nsu` diferente do link inicial, algo como `estabelecimento_id + ano + mes`, pra não confundir com pagamentos anteriores) e envia por e-mail com o valor e a data de vencimento
  - Estabelecimentos com `proximo_vencimento` já vencido e sem pagamento confirmado → marca `ativo = false`, reaproveitando o bloqueio de acesso já desenhado
- **Botão "renovar agora" dentro do admin do estabelecimento**: mostra a data de vencimento e permite gerar (ou reaproveitar, se já existir) o link de pagamento na hora — o dono não depende só do e-mail chegar
- **WhatsApp continua fora** — envio automático é só por e-mail, mesma decisão já tomada antes; nada impede o dono do estabelecimento de encaminhar o link pra si mesmo manualmente
- **Alerta dentro do admin**: banner no topo, recalculado a cada carregamento da tela (não guarda estado de "já mostrei") — aparece nos dias 3, 2, 1 e no dia do vencimento (`dias_restantes = proximo_vencimento - hoje`, banner visível quando isso for `<= 3`), com o texto mudando conforme o dia ("vence em 3 dias" / "vence em 2 dias" / "vence amanhã" / "vence hoje"). **Importante: a comparação é por data civil, não por hora exata** — compara só o dia/mês/ano de hoje com o de `proximo_vencimento`, sempre no fuso horário do Brasil, ignorando a hora do dia. Isso garante que a mensagem só muda uma vez a cada 24h, na virada do dia — não a cada refresh da página, nem dependendo de que horas a pessoa acessou. É só uma conta feita na hora, não um gatilho de disparo único — assim aparece de novo em todo acesso durante essa janela, e continua mostrando (com mensagem de vencido) se passar do prazo sem pagar. Botão "Renovar agora" gera (ou reaproveita) o link de pagamento na hora
- **Tela "Meu Plano"** (em Configurações): sempre acessível, não só perto do vencimento — mostra plano atual, status, data do próximo vencimento, e o botão de renovar disponível a qualquer momento (renovação adiantada é permitida; segue a mesma regra de sempre, `data do pagamento + 30 dias`, então quem renova antes ganha mais dias naquele ciclo, sem tratamento especial)
- Estabelecimentos com `isento = true` não veem banner nem vencimento — a tela "Meu Plano" mostra só "acesso gratuito"

**Em aberto, não decidido**: período de teste grátis antes de cobrar (ex: `ativo = true` por N dias a partir do cadastro) — é uma alavanca de conversão comum, mas fica de fora por enquanto; se decidido depois, é só trocar o valor padrão de `ativo` no cadastro, não exige redesenho.

## Isenção de pagamento (uso pessoal do dono do projeto)

Página separada, só pro dono do projeto (não pros donos de estabelecimento) — pra cadastrar e-mails que ficam isentos de pagar o plano.

- **Login de plataforma**: conta única, separada de `Usuario`/`Estabelecimento` — sem fluxo de convite ou cadastro público, credencial guardada em variável de ambiente. Não deve ser alcançável a partir do login normal do admin de estabelecimento nenhum
- **Nova entidade `EmailIsento`**: email (normalizado — minúsculo, sem espaço), estabelecimento_id (nulo até o e-mail ser de fato usado num cadastro), criado_em
- Tela simples: listar e-mails isentos já cadastrados, adicionar novo, remover
- **`Estabelecimento` ganha o campo `isento`** (booleano) — separado de `ativo`, porque `ativo` sozinho não diz se é isento pra sempre ou um pagante em dia; sem essa marca, uma futura cobrança automática tentaria cobrar quem deveria continuar de graça
- **Cadastro atualizado**: ao criar a conta em `/cadastro`, checa se o e-mail informado está na lista de `EmailIsento` — se estiver, o `Estabelecimento` já nasce com `ativo = true` e `isento = true`, pulando a tela de instrução de pagamento inteira; se não estiver, segue o fluxo normal já descrito

## Segmentos de negócio (ex: estúdio de tatuagem)

Peça pra caber em negócios com lógica de preço diferente (tatuagem é o caso concreto que motivou isso) sem bifurcar o sistema em dois produtos. A regra é: os campos novos são genéricos e úteis pra qualquer estabelecimento — o segmento só controla o que aparece em destaque na tela, não é lógica de backend separada por tipo de negócio.

- **`Estabelecimento.segmento`**: string, padrão `"geral"`; hoje só existe mais uma opção, `"tatuagem"`. Trocado direto no banco pelo dono do projeto — não é uma escolha que o dono do estabelecimento faz sozinho nesta v1, não precisa de tela pra isso
- **`Servico.preco` vira opcional** — sem preço cadastrado, a página pública mostra "a combinar" no lugar do valor
- **`Agendamento.valor_final`** (opcional): quando preenchido, sobrescreve o preço do serviço pro cálculo de faturamento/dashboard. Isso é útil pra qualquer estabelecimento (desconto negociado, serviço com adicional), não só tatuagem — e resolve o problema de o dashboard ficar errado quando o preço do catálogo é só uma estimativa
- **`Agendamento.valor_sinal`** (opcional) + **`sinal_pago`** (booleano) — depósito antecipado
- **`Agendamento.link_referencia`** (opcional, texto simples) — cliente cola o link de uma imagem de referência hospedada em outro lugar; não é upload de arquivo nesta v1, que exigiria um serviço de armazenamento à parte
- Faturamento e dashboard passam a usar `valor_final` quando existir, senão caem no preço padrão do serviço — vale sempre, independente do segmento
- Quando `segmento = "tatuagem"`: cadastro de serviço não exige preço, e o painel do agendamento mostra sinal + link de referência com destaque em vez de escondidos atrás de "mais opções"

## Ícones dos serviços

Dois pontos a construir (escopo confirmado, não é mais só uma pendência):

1. **Seletor de ícone no formulário de serviço**: grade de ícones pra escolher, do mesmo jeito que já existe o seletor de cor.
2. **Tela de configuração dos ícones padrão** (em Configurações): o dono deve poder definir quais ícones ficam disponíveis nesse seletor — não é uma lista fixa no código do frontend. Guardar em `Estabelecimento.icones_padrao` (lista de nomes de ícones lucide-react); uma tela simples permite adicionar/remover ícones desse conjunto. O seletor do formulário de serviço sempre lê dessa lista, nunca de um array hardcoded.

No protótipo visual que já existe, os ícones dos serviços de exemplo foram escolhidos manualmente, um por um, direto no código, sem seletor nem tela de configuração — serve só de referência do visual dos cards, não da funcionalidade em si.

## Fases sugeridas

1. Setup do repositório (backend Go + frontend Vite), banco de dados e migrations — já incluindo `estabelecimento_id` em todas as tabelas e o filtro multi-tenant desde o primeiro CRUD
2. Modelo + CRUD de Servico e Profissional (API e tela admin)
3. CRUD de Agendamento (com profissional e cliente) + agenda mensal no admin (ainda sem notificação)
4. Página pública de agendamento + cálculo de disponibilidade (considerando Bloqueio desde já)
5. Notificações por e-mail (confirmação + aviso pro dono)
6. Autenticação do admin + deploy
7. Dashboard: métricas agregadas (agendamentos e faturamento por dia/semana/mês) + motor de sugestões
8. Agenda semanal/diária, reagendamento, tela de Bloqueio de horários
9. Tela de Clientes (cadastro manual + importação CSV/.vcf + aniversariantes), campo `pago` + separação recebido/a receber no dashboard, exportação CSV
10. Lembretes automáticos por e-mail (cron)
11. Bloqueio de acesso por inadimplência: middleware/checagem de `Estabelecimento.ativo` em todas as rotas do admin (login e sessão) e na página pública, com mensagem amigável no lugar do sistema normal quando `ativo = false`
12. Cadastro e ativação de novos estabelecimentos: página de marketing, formulário de cadastro (cria Usuario dono + Estabelecimento com `ativo = false`), integração com a API de Checkout da InfinitePay (link de pagamento único por cadastro), webhook de confirmação de pagamento que ativa o Estabelecimento automaticamente, botão de verificação manual como fallback
12.1. Renovação mensal: campo `proximo_vencimento`, rotina diária de gerar/enviar link de renovação e de desativar quem venceu sem pagar, banner de alerta no admin perto do vencimento, tela "Meu Plano" com botão de renovar sempre disponível
13. Isenção de pagamento: login de plataforma separado, entidade EmailIsento, tela de gerenciar a lista, checagem no cadastro
14. Segmentos de negócio: campo `segmento` no Estabelecimento, `preco` opcional no Servico, `valor_final`/`valor_sinal`/`sinal_pago`/`link_referencia` no Agendamento, faturamento usando `valor_final` quando existir, telas ajustando destaque conforme o segmento
15. Multi-seleção de profissional na agenda e no dashboard (só pro dono); clientes sumidos (60 dias) na tela de Clientes; resumo semanal por e-mail (cron); encaixe de horários (`concluido_em`, aviso não-bloqueante no admin, página pública inalterada)

## Decisões que não mudar sem repensar

- Cores de serviço vêm de uma paleta fixa de 6, não são livres — é o que mantém a agenda organizada e legível
- Cliente final nunca precisa de login pra agendar
- Sistema é multi-tenant desde a v1 — um backend e um banco compartilhados entre todos os estabelecimentos, nunca um deploy por cliente; é o que faz o preço de R$19,90/mês se sustentar em escala
- Toda consulta ao banco filtra por `estabelecimento_id` — sem exceção, mesmo em rotas novas
- Agendamento nasce `confirmado` por padrão (self-service); aprovação manual do dono é um interruptor opcional futuro, não o comportamento padrão
- Ícones disponíveis no cadastro de serviço vêm de uma lista configurável pelo dono (`icones_padrao`), não de um array fixo no código
- Sugestões do dashboard vêm de regras determinísticas sobre dados reais do próprio estabelecimento, não de IA generativa — mantém previsível, explicável e sem custo de API
- Profissional é o próprio `Usuario` com `papel` auxiliar (login, agenda e horário próprios) — confirmado já implementado; não criar tabela `Profissional` separada
- WhatsApp (confirmação e lembretes) fica de fora por decisão do dono do projeto — notificações são só por e-mail até segunda ordem
- Integração com Google Agenda ficou fora desta rodada de melhorias — é a peça mais cara de construir (OAuth, API externa, tokens por estabelecimento) e a que menos diferencia o produto pro público-alvo (autônomos/pequenos negócios) comparado a ter a experiência principal rápida e bem feita; reavaliar quando o produto já tiver clientes pagantes validando o resto
- Quando `Estabelecimento.ativo = false`, bloqueia tudo — admin e página pública — não só o admin
- Login de plataforma (isenção de pagamento) é uma conta separada de `Usuario`/`Estabelecimento`, sem cadastro público — só pro dono do projeto
- Comunicado de aniversário de cliente é manual — o sistema só mostra a lista de aniversariantes, quem envia é o dono, pelo canal que preferir; não existe disparo automático nesta v1
- Importação de clientes é só CSV e .vcf — a API de Contact Picker do navegador foi descartada por só funcionar no Chrome/Android, deixando iPhone de fora
- Segmento de negócio (`Estabelecimento.segmento`) é trocado direto no banco pelo dono do projeto, não é uma escolha self-service do dono do estabelecimento nesta v1
- Faturamento usa `Agendamento.valor_final` quando existir, senão cai no preço do serviço — vale pra qualquer estabelecimento, não é exclusivo de nenhum segmento
- Ativação de conta é automática via webhook da InfinitePay, não mais manual — o dono do projeto só intervém se o webhook falhar e o botão de verificação manual (fallback) também não resolver
- Renovação mensal: vencimento é sempre `data do último pagamento + 30 dias` (não uma data fixa de calendário) — quem paga atrasado não perde dias de acesso
- Multi-seleção de profissional (agenda e dashboard) é visível só pro dono — auxiliar não escolhe ver outros profissionais
- Encaixe de horário é sempre um aviso, nunca um bloqueio, e só existe no admin — a página pública continua sempre conservadora, mesmo quando o profissional já registrou conclusão antecipada de um atendimento anterior
