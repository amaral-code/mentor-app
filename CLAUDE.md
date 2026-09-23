# CLAUDE.md — Midnight Mentor

Plataforma de estudos para o ENEM (React 19 + TypeScript + Vite 8 + Tailwind 3).
Publicada na **Vercel**. Todo o texto do produto e dos comentários é em
**português do Brasil** — mantenha assim.

## Comandos

```bash
npm run dev      # dev server na porta 5180 (já inclui o back-end /api)
npm run build    # tsc -b && vite build
npm test         # vitest run  (425 testes)
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

- `src/shared/lib/__tests__/regraPontuacao.test.ts` varre `src/`, tira os
  comentários e falha o build se achar um travessão. Duas exceções, as
  duas sobre o caractere em si: a linha que ensina a regra à IA e a
  classe de caractere do parser de gabarito.
- `comRegraDeEscrita` (em `aiService.ts`) injeta a regra no
  `systemInstruction` de **toda** chamada de IA. Fica no ponto único de
  envio de propósito: são mais de dez chamadas, e a próxima nasceria sem
  a linha.

Não há placeholder com travessão. Campo vazio escreve o que está
faltando: `'sem código'`, `'sem dados'`, `'CRP não informado'`.

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
| `teacher` | `EducatorPage` | Só as turmas vinculadas em `turma_professores` (026) |
| `educator` | `EducatorPage` | A escola inteira (secretaria) |
| `parent` | `ParentPage` | Só os filhos com vínculo aceito |
| `psychologist` | `PsicologoPage` | Só pacientes com consentimento vigente |
| `admin` | — | Promoção de papel, só por SQL |

`teacher` e `educator` compartilham a mesma tela **de propósito**: o que muda
é o escopo dos dados, não o conjunto de funcionalidades. Quem decide o que
cada um enxerga é a RLS, nunca o front — esconder um botão não protege nada.

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

### Tabelas planejadas (marketplace e acompanhamento)

Já existem: `psicologos`, `psicologo_disponibilidade`, `agendamentos`,
`vinculos_responsavel`, `alertas_saude_mental`, `telemetria_estudo`,
`indice_burnout` (migrations 010/011).

Faltam:

| Tabela | Para quê |
| --- | --- |
| `consentimentos_dados` | Aluno/responsável libera psicólogo; escopo + validade + revogação |
| `prontuario_notas` | Anotação confidencial de sessão. RLS: **só o psicólogo autor lê** |
| `mensagens_apoio` | Canal psicólogo ↔ aluno/responsável |
| `avaliacoes_psicologo` | Alimenta `psicologos.nota_media`, que hoje é coluna sem fonte |
| ~~`perfis.data_nascimento`~~ | Feito na migration 024 |

**Prontuário tem exigência legal** (CFP Res. 001/2009). O sigilo técnico está
na RLS, mas conformidade legal precisa de validação profissional antes de uso
com paciente real — isto é produto, não parecer jurídico.

## Testes

Vitest. A lógica pura de `shared/lib/` é o que tem cobertura — mantenha a
lógica nova lá em vez de dentro do componente. Testes que mexem em env usam
`vi.resetModules()` + `vi.stubEnv()` + import dinâmico; leitura por função é
compatível com esse padrão.

`server/__tests__/` cobre o worker com Node puro.

## Changelog

Registre aqui toda alteração relevante: rota nova, schema novo, componente
principal, regra de permissão. Mais recente no topo.

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
- Muitos warnings de `react-hooks/exhaustive-deps` (`npm run lint`). Alguns são
  intencionais, outros causam estado velho — avaliar caso a caso.
- `SESSAO-RESUMO.md` e os `.zip` na raiz são de sessões antigas e descrevem um
  arranjo (worker externo + proxy) que **não vale mais** desde a migração para
  `/api`. Não siga aquele arquivo.
