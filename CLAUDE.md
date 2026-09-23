# CLAUDE.md — Midnight Mentor

Plataforma de estudos para o ENEM (React 19 + TypeScript + Vite 8 + Tailwind 3).
Publicada na **Vercel**. Todo o texto do produto e dos comentários é em
**português do Brasil** — mantenha assim.

## Comandos

```bash
npm run dev      # dev server na porta 5180 (já inclui o back-end /api)
npm run build    # tsc -b && vite build
npm test         # vitest run  (773 testes)
npm run lint     # oxlint
```

Antes de dizer que terminou: `npx tsc -b`, `npm test` e `npm run build`
precisam passar. O projeto tem baseline limpo — qualquer erro novo é seu.

## Arquitetura

```
src/
  app/AppShell.tsx        sidebar (md+) + drawer (mobile), lazy import por aba
  App.tsx                 gating: login -> troca de senha -> onboarding -> papel
  features/<dominio>/     uma pasta por tela
  shared/lib/             lógica pura, testável (é onde ficam os testes)
  shared/storage/         repositórios Supabase
  shared/ui/              componentes compartilhados
  stores/                 Zustand (appStore é o principal)
server/worker.js          BACK-END ÚNICO (ver abaixo)
api/                      Vercel Functions
```

Navegação é **por estado** (`activeTab` no `appStore`), não por rota. Não há
router: tudo vive em `/`.

Papéis: `student`, `parent`, `teacher`, `educator`, `psychologist`, `admin`.
Cada um cai numa árvore diferente em `App.tsx`.

## Back-end: um arquivo, três ambientes

`server/worker.js` é escrito só em APIs web padrão (`Request`/`Response`), então
o **mesmo arquivo** roda em:

| Ambiente          | Quem executa                       | Variáveis vêm de      |
| ----------------- | ---------------------------------- | --------------------- |
| `npm run dev`     | `server/devMiddleware.js` (Vite)   | `.env` ou o shell     |
| Vercel            | `api/[...rota].js`                 | Environment Variables |
| Cloudflare (opc.) | `wrangler deploy`                  | `wrangler secret`     |

`server/adapter.js` normaliza a rota: na Vercel só `/api/*` vira função, mas o
worker nasceu com rotas na raiz (`/generate`, `/tts`, `/pagamento`, `/health`,
`/webhook/pagamento`, `/notify/drain`). O adapter tira o `/api` dessas; as que
já nascem com `/api/` passam diretas.

**Não crie um segundo back-end.** Rota nova vai em `server/worker.js` e passa a
existir nos três ambientes de graça. Se a rota for na raiz, acrescente-a ao
`ROTAS_RAIZ` do adapter.

O front chama sempre `urlBackendIA('/rota-do-worker')` (`shared/lib/runtimeConfig.ts`),
que resolve para `/api/...` na mesma origem ou para o worker externo.

## Configuração: a regra que mais importa

**`import.meta.env` é resolvido em BUILD TIME.** O Vite troca cada
`import.meta.env.VITE_X` pelo texto do valor; o que chega ao usuário é uma
string congelada no bundle.

Por isso a configuração é lida **em runtime**, via `/api/config` (lê
`process.env` a cada requisição), e todo acesso é **por função**, nunca por
constante de módulo:

```ts
// CERTO
import { supabaseUrl } from './runtimeConfig';
const url = supabaseUrl();

// ERRADO — congela o valor no import, antes de /api/config responder
const URL = import.meta.env.VITE_SUPABASE_URL;
```

`carregarConfigRuntime()` roda em `main.tsx` antes do primeiro render. Nunca
rejeita e tem teto de 6s: sem back-end, o app cai nos valores do build.

### Segredo nunca leva prefixo `VITE_`

| Prefixo   | Onde é lida        | Serve para |
| --------- | ------------------ | ---------- |
| sem `VITE_` | só em `/api/*`   | **todo segredo** |
| com `VITE_` | dentro do bundle | valor público, e só como reserva |

Segredos: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_TTS_KEY`,
`SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `MP_ACCESS_TOKEN`.
Públicas: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AI_PROVIDER`, `AI_MODEL`.

`/api/config` só devolve o que já seria público. Das chaves de servidor informa
apenas *se* estão configuradas (booleano), nunca o valor. **Nunca adicione uma
chave a essa resposta.**

Mensagem de erro deve citar a variável **sem** prefixo — mandar o usuário
definir uma `VITE_*` secreta é instruí-lo a publicar a chave. Há teste que
trava isso (`aiService.bemestar.test.ts`).

## Regra de escrita (o dono pediu, e há teste travando)

**Travessão (—), meia-risca (–) e hífen solto são proibidos em todo texto
que o usuário lê.** Vale para tela, toast, mensagem de erro, rótulo,
placeholder e para o que a IA responde. Use vírgula, dois-pontos ou ponto
final, ou quebre em duas frases.

Comentário de código e documentação **não** entram na regra: são para
quem mantém o repositório, não para quem usa o app.

Quem garante isso não é boa vontade:

- `src/shared/lib/__tests__/regraPontuacao.test.ts` lê `src/` pela
  **árvore sintática do TypeScript** e olha só o que vira texto (`JsxText`,
  string, parte literal de template). Por isso distingue
  `partes.length - 1` (código) de `'Excelente - nota'` (tela), e `${ano}-${mes}`
  (data) de `valor || '-'` (traço no lugar de valor vazio, que é tela).
  A primeira versão era regex e deixou passar 139 hífens soltos.
  Exceções ficam numa lista com o motivo de cada uma: a linha que ensina
  a regra à IA, o parser de gabarito, `(1 - taxa)`, `calc(` e conta
  aritmética entre números.
- `comRegraDeEscrita` (em `aiService.ts`) injeta a regra no
  `systemInstruction` de **toda** chamada de IA. Fica no ponto único de
  envio de propósito: são mais de dez chamadas, e a próxima nasceria sem
  a linha.

Não há placeholder com traço. Campo vazio escreve o que está faltando:
`'sem código'`, `'sem dados'`, `'sem turma'`, `'CRP não informado'`.
Separador entre dois valores na mesma linha é `·`, nunca `-`.
Marcador de lista dentro de prompt é `•`.

## Convenções

- Comentários explicam **por que**, não o quê. O padrão do repo é comentar a
  decisão e o bug que ela evita. Siga esse tom; não encha de comentário óbvio.
- `getSupabase()` devolve `null` sem configuração — trate, não use `!`.
- Chamada de IA sempre com timeout (`sinalComTimeout`, 30s). `fetch` puro trava
  para sempre numa rede que engole pacotes.
- Nada de segredo em `console.log`. O diagnóstico de rede loga só destino,
  modelo e erro classificado.
- Service worker: **nenhuma** chamada de rede externa ou `/api/*` pode ser
  cacheada (`NetworkOnly` + `navigateFallbackDenylist`). Resposta de IA vinda
  de cache é bug grave.

## Segurança já estabelecida (não regrida)

- Não existe sessão em `localStorage`. Isso foi removido de propósito: dava para
  virar educador digitando no console. Papel vem do JWT + tabela `perfis`.
- RLS ligada em todas as tabelas; XP/loja/foco/burnout só por função
  `SECURITY DEFINER`.
- Foto de redação em bucket privado por dono (`essay_scans/<uid>/...`).

## Perfis e áreas

Seis papéis no banco; quatro aparecem na tela de login (`AuthPage`). O
roteamento é por papel em `App.tsx`, não por rota de URL.

| Papel | Tela | Escopo |
| --- | --- | --- |
| `student` | `AppShell` (16 abas) | Só os próprios dados. **Área completa.** |
| `teacher` | `ProfessorPage` | Só as turmas vinculadas em `turma_professores` (026) |
| `educator` | `EducatorPage` (Painel da Secretaria) | A escola inteira |
| `parent` | `ParentPage` | Só os filhos com vínculo aceito |
| `psychologist` | `PsicologoPage` | Só pacientes com consentimento vigente |
| `admin` | — | Promoção de papel, só por SQL |

**Professor e secretaria têm telas diferentes** (decisão do dono em
2026-09-24, revertendo a tela compartilhada). Antes, o professor abria o
painel da secretaria, com upload de matrícula e troca de código que o
servidor nem deixa ele usar.

| | Secretaria (`EducatorPage`) | Professor (`ProfessorPage`) |
| --- | --- | --- |
| 1 | Matrículas | Como a turma está (termômetro) |
| 2 | Turmas e códigos (troca) | O que revisar (insights) |
| 3 | Docentes | Códigos (só das turmas dele, só leitura) |
| 4 | Visão da escola (termômetro) | |

Os componentes compartilhados recebem o escopo só para ajustar o TEXTO
(`TermometroCognitivo escopo`, `CodigosEscola modo`). Quem decide os
DADOS continua sendo a RLS (`minhas_turmas()`), nunca o front.

### Decisões de produto (não reabra sem falar com o dono)

**Vínculo responsável ↔ aluno: por código gerado pelo ALUNO.**
O aluno vê um código no Perfil e entrega a quem quiser; o responsável digita
no painel. Implementado: funções `vincular_por_codigo`,
`regenerar_codigo_vinculo`, `revogar_vinculo` e `meus_responsaveis`
(migration 024). Quem controla o acesso aos próprios dados é o aluno. O fluxo
antigo (responsável digita o email do aluno, aluno aprova) continua no
`MarketplaceRepository.solicitarVinculo` e não deve ser removido sem migrar
os vínculos existentes.

**Relatório dos pais: números reais + parágrafo da IA.** Feito
(migration 025). O mock foi removido. O que o responsável vê é
**agregado**: minutos, proporção de acerto, dias ativos, matérias. Nunca
a `telemetria_estudo` linha a linha, e nunca conversa, caderno ou humor
escrito pelo estudante. **Não existe nota escolar neste banco** — não
reintroduza "desempenho escolar" em gráfico nenhum sem uma fonte real.

**Consentimento do psicólogo: o aluno autoriza; menor de 16 exige o
responsável.** É a regra da LGPD para dados de criança e adolescente.
`perfis.data_nascimento` **já existe** (migration 024) e o onboarding
pergunta. Data ausente conta como menor, no banco e na tela.
O consentimento é revogável, tem escopo e validade — acesso a dado de saúde
mental de menor não pode ser permanente nem implícito.
**Implementado na 027.** As pontas são EXCLUSIVAS: menor de 16 só o
responsável concede; 16 ou mais só o próprio aluno. Encerrar é aberto a
todos que veem, inclusive ao menor, porque só reduz o acesso. Teto de
180 dias. Escopos: `bem_estar` (índice de cansaço) e `estudo` (resumo da
025). **Não existe escopo para conversa, caderno ou humor**: não reabra.

### Tabelas planejadas (marketplace e acompanhamento)

Já existem: `psicologos`, `psicologo_disponibilidade`, `agendamentos`,
`vinculos_responsavel`, `alertas_saude_mental`, `telemetria_estudo`,
`indice_burnout` (migrations 010/011).

Feitas (024 e 027):

| Tabela | Regra que não pode regredir |
| --- | --- |
| `consentimentos_dados` | Um em aberto por par (índice parcial). Escrita só por função |
| `prontuario_notas` | **Só o autor lê. Só acrescenta**: sem policy de update/delete; corrige com `retificacao`. Leitura NÃO depende do consentimento (a guarda é do profissional); escrever depende |
| `mensagens_apoio` | Cada conversa tem DUAS pontas. O responsável fala com o psicólogo numa conversa própria e **não lê a do filho**. Notificação nunca leva o texto |
| `avaliacoes_psicologo` | Uma por consulta, depois do fim. O profissional lê nota e comentário, **nunca o autor** |
| `perfis.data_nascimento` | Migration 024 |

**Prontuário tem exigência legal** (CFP Res. 001/2009). O sigilo técnico está
na RLS, mas conformidade legal precisa de validação profissional antes de uso
com paciente real — isto é produto, não parecer jurídico.

## Demonstração (migration 028)

A equipe apresenta o produto com **cinco contas, uma por perfil**, numa
escola fictícia. Roteiro e comando prontos em
`supabase/migrations/verificacao/preparar_demonstracao.sql`.

- **Nenhuma conta troca de papel pelo app**, nem as de demonstração. Já
  houve a proposta de um login só com seletor de papel; foi descartada
  porque exigia abrir exceção na trava de `perfis`. Não reabra.
- **Dois mundos que não se misturam.** Triggers em `agendamentos`,
  `consentimentos_dados` e `vinculos_responsavel` recusam qualquer
  ligação entre conta de demonstração e conta real, e a vitrine mostra
  a cada mundo só os seus psicólogos. O motivo: o psicólogo de
  demonstração não tem CRP, e um menor real não pode chegar até ele.
- Conta de demonstração não sai da escola de demonstração
  (`trava_escola_demo`): como secretaria, ela leria agregados reais.
- `contas_demo` tem RLS e **nenhuma policy**; `preparar_demonstracao` e
  `limpar_demonstracao` só rodam pelo SQL Editor.
- Seis alunos fictícios, e não cinco: o termômetro esconde turma com
  menos de 5 medidos, e no piso exato o painel sumiria na apresentação.
- Alunos fictícios têm e-mail em `.invalid` (RFC 2606).

## Testes

Vitest. A lógica pura de `shared/lib/` é o que tem cobertura — mantenha a
lógica nova lá em vez de dentro do componente. Testes que mexem em env usam
`vi.resetModules()` + `vi.stubEnv()` + import dinâmico; leitura por função é
compatível com esse padrão.

`server/__tests__/` cobre o worker com Node puro.

## Changelog

Registre aqui toda alteração relevante: rota nova, schema novo, componente
principal, regra de permissão. Mais recente no topo.

### 2026-09-24 (3) — Uma tela por perfil, e o percurso de cada um
- **Professor ganhou tela própria** (`ProfessorPage`); a antiga virou
  Painel da Secretaria. `CodigosEscola` saiu do cadastro e serve aos dois.
- **Migration 029 — rodar no Supabase.** A 026 reescreveu
  `insights_turma_24h` e mudou o cálculo sem querer: a taxa virou fração
  de 0 a 1, e a tela mostrava "1% da turma" para 5 de 7 alunos. A 029
  devolve o corpo da 020, com o escopo da 026. Há teste que falha sem ela.
  O cartão agora diz "5 de 7 alunos erraram" e, à parte, a taxa de erro.
- **Painel dos pais dizia "tendência de alta" para aluno caindo.** Os
  meses antes da primeira atividade entravam na regressão como 0% de
  acerto (0, 0, 0, 70, 60, 49 sobe). `paraRegistrosMensais` corta os
  meses anteriores ao início; mês vazio DEPOIS do início fica (é sinal de
  que parou). No gráfico, mês sem questão é lacuna, não 0%.
- Painel dos pais em abas (Estudos · Bem-estar e apoio · Outro
  estudante). Passava de 5 mil pixels no celular. Com alerta aberto, abre
  em Bem-estar; o aviso de alerta aparece em qualquer aba.
- Linguagem de pai e mãe: sem "R²", "inclinação", "proxy serverless".
- **Cadastro de matrícula fingia sucesso**: sem serviço de envio, esperava
  1,5 s e mostrava "enviado" sem criar conta. Agora é erro honesto.
- Aluno não achava as mensagens da psicóloga: a Rede de Apoio não tem
  entrada no menu. `AvisoMensagens` aparece na Central e no Perfil só com
  mensagem não lida; o controle do psicólogo também foi para o Perfil.
- Com `FADIGA_ZERADA`, telas diziam "0 · Ritmo saudável" sobre algo que o
  app não mede. O cartão do aluno some; o da família diz que está desligado.
- Página do aluno rolava para o lado no celular (orbe de fundo): o
  contêiner usa `overflow-x-clip` (não `hidden`, que quebra o `sticky`).
- 54 textos de tela ganharam acento (varredura pela árvore sintática, só
  em texto, nunca em string comparada pelo código).
- E-mail de matrícula: o aluno importado já está na turma e não precisa
  digitar código; o responsável é orientado a pedir o código do aluno.

### 2026-09-24 (2) — Contas de demonstração
- **Migration 028 — rodar no Supabase.** Ver a seção Demonstração.
- A vitrine chama `psicologo_visivel`, e não `e_conta_demo`: função
  dentro de view é checada com a permissão de quem consulta, e o
  cliente não pode perguntar sobre qualquer id se ele é demonstração.
- Consulta `isento` aparecia como "pagamento pendente" na lista: o selo
  só conhecia `pago`. Agora é "sem custo".

### 2026-09-24 — Psicólogo (Etapa 4) e a regra do hífen de verdade
- **Migration 027 — rodar no Supabase.** Consentimento, prontuário,
  mensagens e avaliações. 42 casos novos no teste de migração.
- **A faixa de idade deixou de ser pública.** A 024 liberou
  `e_menor_de_16(uuid)` a qualquer logado, com qualquer id. Agora só
  funções `SECURITY DEFINER` chamam; a tela usa `quem_autoriza`, que só
  responde ao próprio aluno e aos responsáveis dele.
- A policy do prontuário consultava a própria tabela e o Postgres
  recusava como recursão infinita (mesmo defeito da 004). Foi para uma
  função `SECURITY DEFINER`; o teste pegou antes do SQL Editor.
- Vitrine mostrava 5,0 estrelas para quem nunca foi avaliado (default da
  coluna). Agora há `total_avaliacoes` e a tela diz "sem avaliações".
- `bem_estar` e `estudo` reaproveitam as guardas existentes:
  `pode_ver_resumo` (025) passou a aceitar o psicólogo com escopo
  `estudo`, em vez de uma cópia das funções de resumo.
- Telas: `AcessoPsicologo` (aluno e responsável, quatro comportamentos
  conforme idade e papel), `Conversa` com aviso do CVV 188 sempre
  visível, `PainelPacientes` e `ConversasProfissional` no painel do
  psicólogo, avaliação na lista de consultas.
- Consulta que já terminou aparecia como "sala pronta". Agora "realizada".
- **O questionário de primeiro acesso era para TODOS os papéis.** O `App`
  checava `onboardingCompleted` antes de olhar o papel, e a flag nasce
  `false` para todo mundo (021): psicólogo, responsável e professor
  respondiam "O que você quer conquistar? Passar no ENEM" no primeiro
  login. Agora é `precisaOnboarding(session)`, só para `student`.
  Provado renderizando o `App` inteiro com e sem a correção.
- O aviso de login mostrava o papel em inglês ("psychologist"), porque
  psicólogo e admin não têm porta na tela de login.
- **A regra do travessão estava incompleta.** O teste só procurava `—` e
  `–`, e ficaram 139 hífens soltos na tela ("Excelente - nota dos
  sonhos"). O teste foi reescrito sobre a árvore sintática e todos foram
  corrigidos, frase por frase.

### 2026-09-23 (3) — Escopo do docente (Etapa 3)
- **`teacher` via os dados de TODAS as turmas da escola.** O CLAUDE.md
  dizia "só as turmas que leciona", mas não existia vínculo nenhum entre
  professor e turma no banco: `termometro_cognitivo` filtrava por escola.
  **Migration 026 — rodar no Supabase.**
- `turma_professores` + `minhas_turmas()` viram a fonte única do escopo.
  `teacher` só vê o que a secretaria vinculou; `educator` continua com a
  escola inteira, que é o trabalho dela.
- `insights_turma_24h` passou a aceitar o professor (antes era só
  secretaria), no escopo dele. É quem faz algo com "metade da turma
  errou função afim".
- Nova aba **Docentes** no painel, só para educator/admin: vincula e
  desvincula professor de turma.
- **Ao rodar a 026, todo professor fica sem turma até a secretaria
  vincular.** É barulhento de propósito: o contrário manteria o acesso
  amplo que a migration existe para fechar. A tela do professor explica
  o que fazer.
- Corrigido de quebra: a fila de abas do painel estourava 109px na
  largura do celular com a quarta aba.

### 2026-09-23 (2) — Regra de escrita: sem travessão
- Pedido do dono. 34 textos de tela reescritos (não foi troca de
  caractere: cada frase virou vírgula, dois-pontos ou duas frases).
- Teste `regraPontuacao` varre `src/` e falha o build se voltar.
- `comRegraDeEscrita` aplica a regra a toda chamada de IA, no ponto único
  de envio. A resposta do Mentor é texto do produto como qualquer outro.
- Placeholders `'—'` viraram `'sem código'`, `'sem dados'` e
  `'CRP não informado'`.

### 2026-09-23 — Painel dos pais com números reais (Etapa 2)
- **`parentMockData.ts` foi DELETADO.** O painel mostrava "Pedro
  Henrique" e 12 meses de nota escrita à mão, com análise de IA por
  cima. Agora vem de `resumo_mensal_aluno`, `resumo_semanal_aluno`,
  `materias_aluno` e `ficha_aluno` (**migration 025 — rodar no Supabase**).
- **O responsável continua SEM ler `telemetria_estudo`.** As funções são
  `SECURITY DEFINER` e devolvem agregado; a tabela segue fechada, porque
  cada linha ali é uma questão específica — conteúdo, não padrão. Há
  teste provando as duas coisas ao mesmo tempo.
- **"Desempenho Escolar" saiu do gráfico.** Nenhuma tabela deste banco
  guarda boletim; a série não tinha de onde vir. Ficou uma linha só,
  chamada pelo que é: acerto nos exercícios do app.
- **A projeção de evasão agora tem piso** (`dadosSuficientes`: 3 meses
  com atividade E 20 questões). Regressão sobre três pontos quase vazios
  devolvia "Alto risco" com cara de conclusão. Sem o piso, a tela diz
  "ainda não dá para dizer" e quanto falta.
- O prompt de `analyzeStudentData` dizia "notas": com dado real, a IA
  escreveria para os pais uma frase sobre a escola que ninguém mediu.
  Agora o prompt explica que o número é acerto no app.
- Qual filho está sendo visto passou para o `ParentPage`: os dois
  painéis mostravam filhos diferentes sem nada dizer na tela.

### 2026-09-22 (tarde) — Vínculo por código, na tela
- **Aluno**: `Perfil → Responsáveis` (`features/profile/SecaoResponsaveis.tsx`)
  mostra o código, copia, gera um novo, lista quem acompanha e revoga.
  Trocar o código **não** expulsa quem já entrou — a tela diz isso, porque
  confundir as duas coisas faria o aluno achar que se livrou de um
  acompanhamento que continua ativo.
- **Responsável**: `EntrarPorCodigo` vira o caminho principal no
  `PainelCuidado`; o pedido por e-mail continua existindo, recolhido num
  `<details>`.
- **Onboarding**: passo 5 pergunta a data de nascimento, com o motivo
  escrito (regra dos 16 anos). **Responder é opcional** — sem data o app
  trata como menor, que é o lado conservador; quem pula preenche depois
  no Perfil.
- `shared/lib/vinculoCodigo.ts`: normalização do código e a regra de
  idade, espelhando `e_menor_de_16`. A idade é calculada sem
  `new Date('AAAA-MM-DD')` — essa forma é meia-noite UTC e, num fuso a
  oeste, volta um dia; na véspera do aniversário de 16 isso trocaria a
  resposta da regra.
- `perfis.data_nascimento` entrou no `select` de `carregarPerfil`: **exige
  a migration 024 aplicada**, senão o login cai no fallback legado.

### 2026-09-22
- **Termômetro Cognitivo** (aba do painel educacional) e **Sala de Foco**
  (body doubling do aluno, sem chat). Migrations **022** e **023** — precisam
  ser rodadas no SQL Editor do Supabase. Feito por outra sessão; não revisado.
- Arquitetura multi-perfil decidida e registrada acima.

### 2026-09-18
- Sistema de abas: `PaginaAtiva` memoizado, `XpFooter` assina o XP sozinho
  (antes cada ganho re-renderizava a árvore inteira), seguidor medido sem
  `setTimeout`, setas/Home/End no teclado, `aria-live` anunciando a seção.
- Transição de aba mantém crossfade com movimento reduzido — desligar tudo
  tirava a única pista de que a seção mudou.

### 2026-09-17
- **Configuração em runtime**: `/api/config` lê `process.env` a cada
  requisição. `import.meta.env` é build-time e congelava valores no bundle.
- **Back-end de IA na Vercel**: `server/worker.js` passa a rodar em três
  ambientes; **um arquivo por rota** em `api/` (rota coringa capturava só um
  segmento e derrubava `/api/chat/completions` com 404).
- Quiz em lotes paralelos (`count * 500` tokens estourava o teto de 8192 do
  servidor e nunca gerava acima de 17 questões).
- Onboarding deixou de repetir a cada troca de aba; 9 animações mortas
  revividas; safe-area no notch; zoom por pinça liberado.

## Pendências conhecidas

- `tools/validar_visual.mjs` tem uma chave **`service_role` do Supabase
  commitada** (linhas ~20-24), válida até 2036, e ela está no histórico do git.
  Precisa ser **rotacionada no painel do Supabase** — remover do arquivo não
  basta.
- **Índice de cansaço desligado (`FADIGA_ZERADA`) x o resto do produto.**
  Com a flag ligada nada é gravado em `indice_burnout`. Em produção, isso
  deixa VAZIOS o termômetro do professor e da secretaria, o índice que o
  psicólogo vê e o escopo `bem_estar` do consentimento. Só a demonstração
  (028) tem dados, porque insere direto. Decisão do dono pendente.
- Muitos warnings de `react-hooks/exhaustive-deps` (`npm run lint`). Alguns são
  intencionais, outros causam estado velho — avaliar caso a caso.
- `SESSAO-RESUMO.md` e os `.zip` na raiz são de sessões antigas e descrevem um
  arranjo (worker externo + proxy) que **não vale mais** desde a migração para
  `/api`. Não siga aquele arquivo.
