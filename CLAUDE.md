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
- **Notificações**: Brevo (e-mail, API transacional REST direta, sem SDK) — já implementado como service layer própria (`internal/notifications`), padrão nil-safe (sem `BREVO_API_KEY`, o `Notificador` é `nil` e todo envio vira no-op em vez de travar o boot). WhatsApp fica pra depois — ver "Integração futura com WhatsApp" e "Decisões que não mudar sem repensar"

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

- **Estabelecimento**: nome, `slug` (identifica a URL pública do estabelecimento), telefone, endereço (opcional), horário de funcionamento por dia da semana, `plano` (string, hoje sempre `"padrao"`), `ativo` (booleano, controla acesso enquanto a cobrança é manual), `isento` (booleano, separado de `ativo` — marca quem nunca deve ser cobrado, ver "Isenção de pagamento"), `proximo_vencimento` (data, ver "Renovação mensal"), `segmento` (string, padrão `"geral"` — ver "Segmentos de negócio"), `icones_padrao`, `desconto_profissional_percentual` (opcional — ver "Cadastro de produtos"), `dias_reagendamento` (opcional — ver "Reagendamento automático")
- **EmailIsento**: email (normalizado), estabelecimento_id (nulo até ser usado), criado_em — não pertence a nenhum estabelecimento, é uma lista global gerenciada só pelo dono do projeto (lista configurável de nomes de ícones lucide-react disponíveis no cadastro de serviço — ver seção "Ícones dos serviços")
- **Usuario** (login): email, senha (hash), `papel` (`dono` | `auxiliar` — promovível/rebaixável pelo dono, ver "Profissionais"), horário de trabalho, `pode_cadastrar_servico_individual` (booleano — ver "Serviços individuais"), estabelecimento_id — auxiliares são convidados por e-mail e viram "profissionais" com login e agenda próprios (confirmado já implementado no código real; não criar uma tabela `Profissional` separada)
- **Servico**: nome, preco (opcional — ver "Segmentos de negócio"), duracao_min, `duracao_max_min` (opcional — ver "Duração variável de serviço"), descricao, cor (chave de uma paleta fixa — ver abaixo), icone, `profissional_id` (opcional — ver "Serviços individuais"), estabelecimento_id
- **Cliente**: nome, telefone (identifica o cliente dentro do estabelecimento), `data_nascimento` (opcional), estabelecimento_id — criado/atualizado automaticamente a cada novo agendamento, sem precisar de cadastro manual separado; guarda também `ultimo_aviso_reagendamento_em` (controle interno, não exibido — ver "Reagendamento automático")
- **Agendamento**: cliente_id, servico_id, profissional_id (referencia `Usuario`, não uma tabela `Profissional` separada), data, hora, status (`pendente` | `confirmado` | `cancelado`), pago (booleano), `valor_final` (opcional, sobrescreve o preço do serviço no faturamento), `valor_sinal` (opcional) + `sinal_pago` (booleano), `link_referencia` (opcional), `concluido_em` (data/hora, opcional — ver "Encaixe de horários"), `lembrete_enviado` + `lembrete_final_enviado` (controle interno dos dois lembretes automáticos — ver "Lembretes automáticos"), observacoes, estabelecimento_id
- **Bloqueio**: data, hora_inicio, hora_fim (nulo = dia inteiro), motivo (opcional), profissional_id (nulo = bloqueia o estabelecimento inteiro), estabelecimento_id — usado pra folga, almoço, férias etc.; entra no mesmo cálculo de disponibilidade que já existe pros agendamentos, não é um sistema separado
- **Produto** / **VendaProduto**: catálogo com estoque + vendas pra cliente final ou compra interna de profissional — ver "Cadastro de produtos"
- **RegistroAtividade**: histórico simples de ações da equipe (usuario_id, acao, descricao já pronta em texto), visível só pro dono na tela Equipe — ver "Histórico de atividades"

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
- **Cadastro de serviços**: listagem em cards com barra de cor lateral; criar/editar/excluir; campos nome, preço, duração (fixa ou variável — ver "Duração variável de serviço"), descrição, cor (paleta fixa de 6) e ícone

### 3. Notificações
- **Só e-mail por enquanto (Brevo)** — confirmação pro cliente assim que agenda, e aviso pro dono a cada novo agendamento. WhatsApp fica de fora deste momento por decisão do dono do projeto — ver "Integração futura com WhatsApp" (mapa já desenhado, só falta a ação manual do dono no Meta Business) e "Decisões que não mudar sem repensar"

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
  - **Serviço com procura fraca**: compara, dentro do mês corrente, a quantidade de agendamentos de cada serviço — se o mais fraco está abaixo de 60% da média dos outros (e há pelo menos 2 serviços diferentes no período, senão não há com o que comparar), sugere uma promoção nele: desconto por tempo limitado ou combo junto do serviço mais procurado (citado pelo nome, não é texto genérico). Tom muda conforme o contexto: se já existe outro alerta na mesma passada, essa sugestão também vira alerta; se o resto está indo bem, vira "oportunidade de crescer ainda mais", nunca soando como problema
  - **Funciona automaticamente por profissional**: o motor roda em cima da lista de agendamentos que já chega filtrada por quem chama (`aplicarFiltroProfissional`) — então o dono já consegue comparar "cada profissional e ele mesmo" bastando selecionar UM profissional de cada vez no filtro que já existe no Dashboard (o próprio dono também aparece nessa lista, já que é um `Usuario`/profissional agendável como qualquer outro). Não foi criada nenhuma tela nova nem cálculo lado a lado — é a mesma sugestão de sempre, só que escopada
  - Coberto por testes automatizados (`internal/handlers/dashboard_sugestoes_test.go`) cobrindo casos-limite: sem histórico, um serviço só, empate, diferença pequena que não deve disparar, três serviços com exclusão correta do próprio fraco na média, filtro de período, e ausência de NaN/Inf em qualquer cenário

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

### Promover/rebaixar (acesso total de um auxiliar)

O dono pode dar a um auxiliar específico acesso total, igual o dele — não é uma permissão granular nova, é literalmente mudar `Usuario.Papel` pra `dono` (reversível a qualquer momento pela mesma tela). Reaproveita 100% das travas de `ExigirDono()` que já existem (Equipe, Configurações, Bloqueios, multi-seleção de profissional) — nenhuma tela precisou de lógica de permissão nova.

- Botão "Promover a dono" / "Rebaixar a auxiliar" em cada linha da tela Equipe, visível só pro dono
- Nunca aceita mudar o próprio papel por essa rota (`PATCH /admin/profissionais/:id/papel`) — evita o dono se rebaixar sem querer e o estabelecimento ficar sem ninguém com acesso total
- **Importante**: o JWT já emitido carrega o papel no momento do login e dura 30 dias — quem for promovido/rebaixado só vê o efeito depois de sair e entrar de novo. A tela já avisa isso no toast de confirmação

### Serviços individuais

Por padrão, `Servico` continua sendo do catálogo geral (comportamento de sempre: qualquer auxiliar pode criar/editar, visível pra clientes escolherem com qualquer profissional). A novidade é **aditiva**, não troca esse comportamento: um auxiliar pode, opcionalmente, cadastrar um serviço vinculado só a ele mesmo.

- **`Servico.ProfissionalID`** (opcional, aponta pra `Usuario`): `nil` = catálogo geral (padrão); preenchido = serviço individual, só existe pra aquele profissional
- **`Usuario.PodeCadastrarServicoIndividual`** (booleano, concedido pelo dono na tela Equipe): sem essa permissão, um auxiliar só consegue criar serviço no catálogo geral, exatamente como hoje — a permissão só adiciona a opção de marcar "serviço individual (só seu)", nunca restringe o que já funcionava
- Um auxiliar com a permissão só pode vincular o serviço a si mesmo, nunca a um colega (validado no backend); o dono pode atribuir livremente a qualquer profissional da equipe, sem precisar da permissão (o dono já pode tudo)
- **Página pública**: serviço individual pula o passo de "escolher profissional" — o cliente nem sabe que existem outros, o profissional já vem implícito. Mostra um selo "Só com [Nome]" no card do serviço
- Resolve a pergunta original que motivou essa feature: hoje, sem essa marcação, um serviço cadastrado por QUALQUER pessoa (dono ou auxiliar) aparece pra todo mundo escolher com qualquer profissional — só fica exclusivo de alguém quando explicitamente marcado como individual

## Histórico de atividades

O dono vê, numa seção nova dentro da própria tela Equipe, um histórico simples (`RegistroAtividade`, últimos 100) de quatro ações específicas — não é um log genérico de auditoria de tudo que acontece no sistema:

- Quem cadastrou um serviço (dono ou auxiliar — a descrição já deixa claro quem foi)
- Quem criou um agendamento pelo painel admin (não conta o self-service da página pública, que não é "ação de um profissional")
- Quem cancelou um agendamento pelo painel (idem — cancelamento feito pelo próprio cliente na página pública não entra)
- Quem marcou um agendamento como pago (só a transição pra pago conta; desmarcar não gera entrada nova)

Cada linha já vem com a descrição pronta em texto (ex: "Cadastrou o serviço "Corte Masculino""), congelada no momento do registro — não depende de join nenhum depois, então continua legível mesmo que o serviço seja renomeado ou o agendamento role pra fora do período visível em outro lugar do sistema.

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

- **Dois lembretes por e-mail (Brevo)**, não um só: o primeiro sai 3h antes do horário marcado, o segundo 30 minutos antes — cada um com seu próprio controle de duplicidade (`Agendamento.lembrete_enviado` e `lembrete_final_enviado`, dois booleanos separados) pra um não pisar no outro. **Só e-mail por enquanto**, sem WhatsApp (ver "Integração futura com WhatsApp")
- Cron próprio (`internal/lembretes`), sem lib externa — um laço em goroutine que acorda a cada 15 minutos e verifica as duas janelas de antecedência (3h e 30min) numa passada só. É a primeira peça de infraestrutura do projeto que não é só "responder a um pedido HTTP" — mesmo padrão reaproveitado depois por `internal/renovacao`, `internal/resumosemanal` e `internal/reagendamento`
- **Resumo semanal por e-mail pro dono**: toda segunda-feira, e-mail automático com o resumo da semana anterior — faturamento, número de agendamentos, e a sugestão do dashboard daquele momento. Objetivo é o dono saber como foi a semana sem precisar abrir o sistema. Mesma infraestrutura de cron dos lembretes, só um gatilho semanal em vez de diário

## Duração variável de serviço

Alguns serviços não têm uma duração fixa (ex: massagem que pode levar de 30 a 60 minutos, dependendo do cliente) — sem essa flexibilidade, o dono é forçado a cadastrar sempre o pior caso como duração fixa, superestimando o tempo de todo atendimento daquele serviço.

- **`Servico.duracao_max_min`** (opcional, inteiro em minutos): `nil` = duração fixa, comportamento de sempre. Preenchido = o serviço tem uma faixa, e `duracao_min` vira o piso dela em vez de duração única. Validado no backend: só aceita `duracao_max_min > duracao_min`
- **Quem decide a duração real de cada atendimento é sempre o profissional, na hora — não o cliente.** A página pública nunca pergunta nem deixa escolher; só mostra "de X a Y min" no card do serviço. Essa foi uma decisão deliberada pra não complicar o fluxo público com uma etapa nova nem abrir a porta pra preço variar por duração escolhida
- **A agenda sempre bloqueia usando o teto da faixa** (`duracao_max_min`), nunca o mínimo — em qualquer serviço com faixa, o cálculo de "horário ocupado" (tanto a disponibilidade pública quanto a checagem de conflito no admin) usa `Servico.DuracaoEfetivaMin()`, que devolve o máximo quando existe. É a mesma lógica conservadora do resto do sistema: nunca dar conflito de agenda por causa de um atendimento que acabou levando mais tempo que o esperado
- **Reaproveita o encaixe de horários já existente**: quando o profissional termina antes do teto da faixa, é só clicar em "Concluir agora" (botão que já existe, ver "Encaixe de horários") — o resto do horário libera na hora, exatamente como já acontece hoje pra duração fixa. Não foi criado nenhum mecanismo novo só pra isso
- Motor de sugestões do dashboard (ocupação, duração média) também passou a usar `DuracaoEfetivaMin()` — consistente com o que de fato fica reservado na agenda

## Cadastro de produtos

Sistema básico de catálogo + financeiro simples pra produtos (ex: cosméticos, insumos) — vendidos pro cliente final (avulso ou junto de um serviço) ou comprados internamente pela equipe, com desconto opcional.

- **`Produto`**: nome, preço, custo unitário (opcional — habilita cálculo de lucro), quantidade em estoque, estoque mínimo (0 desliga o alerta), ativo (desativar em vez de excluir preserva histórico de vendas), foto opcional
- **`VendaProduto`**: registra cada saída de estoque — `tipo_comprador` (`cliente` | `profissional`), quantidade, preço e desconto **congelados no momento da venda** (mudar o preço do produto ou o desconto padrão depois não altera vendas passadas), vínculo opcional com um `Agendamento` (produto levado junto do serviço) ou com um `Cliente` avulso, `pago` e `cancelada` (cancelar devolve a quantidade pro estoque)
- **Desconto da equipe**: `Estabelecimento.desconto_profissional_percentual` (opcional) pré-preenche automaticamente a compra interna de um profissional — configurável em Configurações, editável por venda
- **Baixa de estoque é atômica** (`UPDATE ... WHERE quantidade_estoque >= ?`) — duas vendas concorrentes do mesmo produto nunca deixam o estoque negativo
- **Faturamento do dashboard só conta venda pro cliente final** — compra interna de profissional (mesmo com desconto zero) nunca entra como faturamento, porque representa consumo interno, não receita do negócio. Métricas de produto no dashboard são visíveis só pro dono (venda pro cliente final não tem profissional atribuído, então não dá pra escopar corretamente pra um auxiliar)
- **Importação em lote via PDF ou XLSX** (upload de uma lista de produtos com nome e preço): sempre passa por uma **prévia editável** antes de qualquer produto ser criado — a leitura de PDF é heurística (procura o padrão "nome ... valor" linha a linha, só funciona em PDF com texto selecionável, não em imagem escaneada) e pode errar em layouts fora do comum; XLSX é mais confiável (lê colunas por cabeçalho reconhecível — "Nome"/"Produto" e "Preço"/"Valor" — ou cai em A=nome, B=preço sem cabeçalho). Confirmar a importação casa por nome (sem diferenciar maiúsculas/acentos) dentro do estabelecimento: já existe, atualiza o preço; não existe, cria com estoque zerado

## Reagendamento automático

Depois de um período configurável sem o cliente agendar de novo, o sistema manda um e-mail sozinho sugerindo um novo horário — sem exigir que o dono lembre de checar quem sumiu.

- **`Estabelecimento.dias_reagendamento`** (opcional, inteiro): `nil` = feature desligada (padrão). Configurável em Configurações, só pelo dono. **Separado de propósito do limiar fixo de "cliente sumido"** (60 dias, só um badge passivo na tela de Clientes) — esse aqui é um envio ativo de e-mail, e o dono pode querer disparar bem antes dos 60 dias
- **Rotina diária** (`internal/reagendamento`, mesma infraestrutura de cron de sempre): pra cada estabelecimento com a feature ligada, acha clientes cujo último agendamento confirmado passou do limiar configurado — mesma query de "último agendamento" já usada pro cálculo de cliente sumido, só que com o limiar vindo do estabelecimento em vez de fixo
- **Controle de duplicidade**: `Cliente.ultimo_aviso_reagendamento_em` — só dispara de novo se o cliente agendar de novo e sumir mais uma vez (não reenvia todo dia enquanto ele continuar inativo)
- **Só alcança quem tem e-mail cadastrado** — mesma limitação do lembrete de agendamento comum; sem e-mail, não há como avisar automaticamente
- **Reaproveitamento inteligente do último horário**: o sistema procura, nas próximas semanas, se o mesmo dia da semana e horário do último agendamento do cliente continua livre pro mesmo profissional/serviço (mesma conta conservadora de disponibilidade de sempre, nunca considera `concluido_em`). Se achar, o e-mail já vem com esse horário sugerido; se não achar em algumas semanas, cai num link genérico de agendar
- **Decisão de segurança importante: o link do e-mail NUNCA cria o agendamento sozinho, mesmo com o horário sugerido.** Ele leva pro formulário público já com serviço/profissional/data/hora/nome/telefone pré-preenchidos (via query string), mas o cliente sempre precisa clicar em "Confirmar agendamento" — o fluxo normal de sempre, só que com menos digitação. Um link que reservasse direto ao ser aberto (GET) seria perigoso: e-mails corporativos e alguns apps pré-carregam/escaneiam links automaticamente antes da pessoa nem ver a mensagem, o que criaria agendamentos fantasmas sem ninguém ter pedido
- Se o horário sugerido não estiver mais livre quando o cliente tentar confirmar (alguém pegou primeiro), cai no mesmo tratamento de conflito que a página pública já tem hoje — volta pro seletor de horário com um aviso, não trava

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

## Integração futura com WhatsApp (mapa de implementação)

WhatsApp continua fora do escopo ativo por decisão do dono do projeto (ver "Decisões que não mudar sem repensar") — mas o caminho pra ligar quando fizer sentido já está mapeado aqui, pra não perder o que foi decidido. Caminho escolhido: **API oficial da Meta (WhatsApp Cloud API), direto, sem provedor intermediário (BSP)** — mesmo espírito de "uma credencial só" que já usamos com o handle da InfinitePay, sem mensalidade extra de terceiro.

### O que só o dono do projeto pode fazer (ações fora do código)

Nenhuma dessas etapas depende de código — são todas no painel da Meta. Até elas estarem prontas, a implementação técnica abaixo não tem como ser testada de verdade.

1. **Ter (ou criar) uma conta no Meta Business Suite** (business.facebook.com) em nome do AgendHora
2. **Verificar o negócio** ("Business verification") — a Meta pede documentos da empresa; sem isso, o número fica limitado a poucas conversas/dia
3. **Criar um app em developers.facebook.com**, tipo "Business", e adicionar o produto **WhatsApp** a esse app
4. **Cadastrar um número de telefone** pro WhatsApp Business Platform — **não pode ser um número já em uso no WhatsApp comum ou WhatsApp Business App** (precisa "sair" de lá antes, ou usar um número novo). Pra testar antes de migrar o número real, a Meta libera um número de teste temporário
5. **Criar os templates de mensagem** (um por tipo de notificação — ver lista abaixo) no painel "WhatsApp Manager" > "Modelos de mensagem", categoria **Utility**. Cada template precisa ser aprovado pela Meta antes de poder ser usado (geralmente minutos, às vezes até 1–2 dias) — esse é o gargalo mais provável, então vale criar os templates com antecedência
6. **Gerar um token de acesso permanente**: no "Business Settings" > "Usuários do sistema" ("System users"), criar um usuário do sistema com permissão nesse app, e gerar um token **sem expiração** (o token de teste que aparece direto no painel do app expira em 24h — não serve pra produção)
7. **Anotar 3 valores** do painel do WhatsApp (aba "API Setup" do app): `Phone Number ID`, `WhatsApp Business Account ID` (WABA ID), e o token gerado no passo 6
8. **Escolher uma string qualquer** pra ser o "Webhook Verify Token" (a Meta exige um webhook configurado mesmo só pra mandar mensagem, não só pra receber) — qualquer senha aleatória serve, é só pra confirmar que o backend é dono do webhook

Confira o preço vigente na documentação oficial antes de decidir o número — a Meta cobra por conversa iniciada (não por mensagem individual), com uma cota mensal de conversas gratuitas em categoria *utility* que muda de tempos em tempos.

### O que eu (Claude Code) faço depois que os 3 valores acima existirem

Só dá pra implementar de verdade depois do passo 7 acima — sem token/phone_number_id reais não tem como testar. Quando estiver pronto, é isto:

1. **4 novas variáveis de ambiente** em `config.go`: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — seguindo o mesmo padrão do resto do `Config`: variável vazia desliga a feature sem travar o boot
2. **Novo pacote `internal/whatsapp`**, espelhando exatamente o padrão nil-safe do `internal/notifications` de hoje: `New(token, phoneNumberID string) *Cliente` devolve `nil` se `token == ""`, e todo método começa com `if c == nil { return }` — chamar em qualquer lugar do código continua seguro mesmo com WhatsApp desligado
3. **Um template por tipo de notificação já existente** — cada `NotificarXxx` do `Notificador` (confirmação, cancelamento, lembrete 3h, lembrete 30min, reagendamento) ganha um envio equivalente por WhatsApp, usando o `Phone Number ID` + template aprovado + variáveis (`{{1}}`, `{{2}}`...) preenchidas com nome do cliente/serviço/data/hora — a API da Meta só aceita template fora da janela de 24h de conversa ativa, texto livre não funciona pra mensagem iniciada pelo negócio
4. **Rota pública `POST /webhooks/whatsapp`** (fora de `/api`, igual `/webhooks/infinitepay` hoje) — a Meta exige isso mesmo só pra enviar; recebe status de entrega/leitura e a validação de assinatura (`X-Hub-Signature-256`). Uma segunda rota `GET /webhooks/whatsapp` faz o handshake de verificação inicial (devolve o `hub.challenge` se o `hub.verify_token` bater com `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)
5. **`Cliente.Telefone` já existe e já é o dado necessário** — nenhuma migration nova pra isso, só precisa normalizar pro formato E.164 (`55` + DDD + número, sem símbolos) na hora de montar a chamada
6. Cada `NotificarXxx` passa a mandar e-mail **e** WhatsApp (quando configurado) — não um no lugar do outro; o texto de cada canal pode divergir levemente (WhatsApp é mais curto/direto), mas a decisão de quando disparar continua sendo a mesma dos dois lados

### Templates a criar no painel (nomes sugeridos, pra já ir preparando)

`agendamento_confirmado`, `agendamento_cancelado`, `lembrete_3h`, `lembrete_30min`, `aviso_reagendamento` — todos categoria **Utility** (não *Marketing*, que tem regra de opt-in mais rígida e custo maior).

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
16. Cadastro de produtos: `Produto`/`VendaProduto`, estoque atômico, compra interna de profissional com desconto configurável, importação em lote via PDF/XLSX com prévia editável
17. Duração variável de serviço (`Servico.duracao_max_min`), sempre bloqueando pelo teto da faixa
18. Segundo lembrete automático (30 min antes, além do de 3h já existente) e reagendamento automático por inatividade (`Estabelecimento.dias_reagendamento`, reaproveitamento inteligente do último horário, sempre com confirmação manual do cliente)
19. Integração com WhatsApp (Cloud API da Meta) — mapa técnico pronto (ver "Integração futura com WhatsApp"), implementação real depende de ações manuais do dono do projeto no Meta Business primeiro
20. Promover/rebaixar auxiliar (acesso total, reversível); serviços individuais (`Servico.ProfissionalID` + `Usuario.PodeCadastrarServicoIndividual`, aditivo); histórico de atividades da equipe na tela Equipe; sugestão de promoção por serviço fraco no motor de sugestões (funciona por profissional reaproveitando o filtro já existente no Dashboard)

## Decisões que não mudar sem repensar

- Cores de serviço vêm de uma paleta fixa de 6, não são livres — é o que mantém a agenda organizada e legível
- Cliente final nunca precisa de login pra agendar
- Sistema é multi-tenant desde a v1 — um backend e um banco compartilhados entre todos os estabelecimentos, nunca um deploy por cliente; é o que faz o preço de R$19,90/mês se sustentar em escala
- Toda consulta ao banco filtra por `estabelecimento_id` — sem exceção, mesmo em rotas novas
- Agendamento nasce `confirmado` por padrão (self-service); aprovação manual do dono é um interruptor opcional futuro, não o comportamento padrão
- Ícones disponíveis no cadastro de serviço vêm de uma lista configurável pelo dono (`icones_padrao`), não de um array fixo no código
- Sugestões do dashboard vêm de regras determinísticas sobre dados reais do próprio estabelecimento, não de IA generativa — mantém previsível, explicável e sem custo de API
- Profissional é o próprio `Usuario` com `papel` auxiliar (login, agenda e horário próprios) — confirmado já implementado; não criar tabela `Profissional` separada
- WhatsApp (confirmação e lembretes) fica de fora por decisão do dono do projeto — notificações são só por e-mail até segunda ordem. O caminho técnico já está mapeado (ver "Integração futura com WhatsApp"), mas as ações de configuração no Meta Business são manuais e ficam com o dono do projeto — a implementação de código só começa depois delas
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
- Duração variável de serviço: só o profissional decide a duração real, na hora (via "Concluir agora") — o cliente nunca escolhe na página pública, e a agenda sempre bloqueia pelo teto da faixa, nunca pelo mínimo
- Importação de produtos (PDF/XLSX) sempre passa por uma prévia editável antes de salvar qualquer coisa — nunca cria produto direto a partir do arquivo, porque a leitura de PDF é heurística e pode errar
- Faturamento de produtos só conta venda pro cliente final — compra interna de profissional nunca conta como receita, mesmo sem desconto nenhum
- O e-mail de reagendamento automático nunca cria o agendamento sozinho ao ser aberto — só pré-preenche o formulário público, o cliente sempre confirma manualmente (decisão de segurança: evita que um link pré-carregado por scanner de e-mail reserve um horário sem ninguém ter pedido)
- Limiar de "cliente sumido" (60 dias, badge passivo) e `dias_reagendamento` (envio ativo de e-mail, configurável) são decisões independentes — mudar um não muda o outro
- "Acesso total" pra um auxiliar é literalmente promover `Usuario.Papel` pra `dono` (reversível) — não criar um sistema de permissões granulares separado enquanto não houver um caso de uso real que precise de nuance
- Serviço individual (`Servico.ProfissionalID`) é aditivo — nunca restringe o que já funcionava (qualquer auxiliar continua editando o catálogo geral livremente); só adiciona a opção de um serviço ficar exclusivo de quem tem a permissão `PodeCadastrarServicoIndividual`
- Histórico de atividades é só as 4 ações pedidas (serviço criado, agendamento criado pelo painel, cancelado, marcado como pago) — não é log genérico de auditoria de todo o sistema, e nunca inclui ações do próprio cliente na página pública (self-service não é "ação de profissional")
