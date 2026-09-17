# 🌙 Midnight Mentor - Mentor ENEM

> Projeto criado para o **HackaTown do HackTudo** — idealizado e construído para o hackathon.

Plataforma inteligente de estudos para o ENEM com IA, gamificação, análise emocional,
ligas colaborativas e dashboards multi-perfil (aluno, educacional, pais, psicólogo).

## Tech Stack

| Camada       | Tecnologia                                                              |
| ------------ | ----------------------------------------------------------------------- |
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS 3                          |
| **Estado**   | Zustand 5 (sincronização com Supabase)                                  |
| **IA**       | DeepSeek V4 Flash via back-end (padrão) ou Google Gemini (chave própria) |
| **Diagramas**| Mermaid 11 (`mindmap`, `graph TD`)                                      |
| **CSV**      | PapaParse 5 (worker + chunking para arquivos grandes)                   |
| **Backend**  | Supabase (auth + banco relacional com RLS)                              |
| **Testes**   | Vitest 4 (+ PGlite: migrations rodadas num Postgres real)               |
| **Lint**     | Oxlint                                                                  |

## Funcionalidades

### 👨‍🎓 Aluno
- **Central de Comando** - Dashboard com plano do dia, SSC (sono/cansaço/humor), streak, progresso XP
- **Mentor IA** - Chat com 5 modos temáticos (ENEM Geral, Exatas, Natureza, Humanas, Vestibulares), busca em provas oficiais com badge de fonte consultada, método socrático e densidade adaptada ao horário
- **Redação por foto** - Fotografe a folha do caderno: OCR da letra manuscrita + correção pelas 5 competências, com imagem e transcrição lado a lado
- **Quiz Adaptativo** - Questões geradas por IA por matéria/tópico (sem repetição), flashcards do Caderno
- **Redação** - Corretor offline com 5 competências ENEM (0–1000)
- **Ligas de Estudo** - Salas colaborativas com chat WhatsApp, desafios diários, metas e ranking
- **Caderno de Estudos** - Anotações com Notebook AI Studio (resumo, mapa mental Mermaid, flashcards, gaps)
- **Ranking** - Por turma, escola ou geral com gamificação (XP, nível, streak)
- **Modo Foco** - Timer Pomodoro com integração emocional
- **Escudo de Dopamina** - Modo ENEM: o app conta o tempo de tela bloqueada e converte em moedas de foco (faixas por duração, penalidade por interrupção, teto diário)
- **Pílulas de Áudio** - Micro-podcasts de 3 min gerados por IA + TTS; sem IA, toca a versão curta de bolso com a voz do aparelho
- **Calendário Adaptativo** - Revisão espaçada (Ebbinghaus/SM-2): a nota do quiz define o dia exato da próxima revisão, sem montar cronograma
- **Índice de Fadiga** - Modelo de burnout que observa o ritmo de estudo e avisa antes do esgotamento
- **Intervenção de Doomscrolling** - Rolagem sem decidir por 2 min congela a interface e a IA propõe uma tarefa mínima
- **Rede de Apoio** - Consultas com psicólogo, aprovação de acompanhamento pelos pais e avisos
- **Relatório de Descompressão** - Toda sexta, um parágrafo de validação sobre sono, tempo offline e constância - não sobre acertos
- **Estatísticas** - Desempenho por tópico (acertos/erros) alimentado por cada quiz

### 🏫 Educacional
- Painel exclusivo com **dois modos de cadastro**: upload de CSV ou tabela manual dentro do app (com coluna Tipo: Aluno/Docente)
- **Tutorial embutido** ("Como usar?") com passo a passo + botão **Baixar modelo CSV**
- Tabela manual com validação inline (email/telefone), rascunho auto-salvo no navegador e limite de 500/envio
- **Códigos confidenciais**: código da instituição (8 letras) + código por turma, com copiar e regenerar (vazou, trocou)
- **Importação com IA** (`POST /api/turmas/import` no worker): normaliza a lista, cria contas com senha temporária de uso único, envia email com login + link mágico + códigos; relatório por linha no painel
- **Primeiro acesso**: troca de senha obrigatória + tour guiado automático do aluno + códigos no Perfil
- Suporte a arquivos grandes com PapaParse (worker + chunking), teto de 2MB e validação de colunas
- Preview dos dados antes do envio (PII mascarada); webhook N8N como reserva
- Colunas esperadas: `Nome do Aluno`, `Sala`, `Email do Responsável`, `Telefone do Responsável`[, `Tipo`]

### ♿ Acessibilidade
- Painel no Perfil: tamanho da letra (normal/grande/extra), alto contraste, reduzir movimento e filtro de daltonismo (8 tipos)
- Tudo aplicado no aparelho, valendo do login ao F5; botão flutuante de daltonismo sincronizado
- Skip-link "Pular para o conteúdo", foco visível, `role=switch/radio` nos controles, inputs 16px no mobile (sem zoom forçado do iOS)
- Layout responsivo iPhone (390px), tablet (820px) e notebook (1366px) verificado, sem rolagem horizontal

### 👪 Pais / Responsáveis
- Dashboard de acompanhamento pedagógico
- Cards de desempenho e alertas
- **Curva de estresse** do estudante (índice diário de fadiga, 30 dias)
- **Alertas de saúde mental** disparados pelo modelo, com ação direta no próprio card
- **Marketplace de psicólogos** - catálogo com CRP e valor visível, agenda, pagamento e criação automática da sala de videochamada
- **Vínculo aprovado pelo estudante**: enquanto ele não aceita, o painel não mostra nada. E nunca mostra conversas, anotações ou registros de humor - só padrão de estudo

### 🧑‍⚕️ Psicólogos
- Painel próprio ao entrar: agenda com link da sala + janelas semanais de disponibilidade
- Papel `psychologist` (criado por `registrar_psicologo()` no banco, após conferência do CRP)
- Ficha pública com especialidades, abordagem e valor
- Janelas semanais de disponibilidade; os horários concretos são derivados delas
- Agenda com link da sala, sem sobreposição (garantida por constraint no banco)

## Arquitetura

```
src/
├── app/
│   └── AppShell.tsx            # Shell com sidebar + bottom nav mobile
├── features/
│   ├── agenda/                 # Agenda do aluno
│   ├── atmo/                   # Partículas animadas de fundo
│   ├── audio/                  # Pílulas de áudio + player
│   ├── auth/                   # Login multi-perfil + troca de senha
│   ├── calendario/             # Revisão espaçada (SRS)
│   ├── chat/                   # Mentor IA com personas
│   ├── comunidade/             # Mural comunitário + Ligas de estudo
│   ├── cuidado/                # Rede de apoio
│   ├── dashboard/              # Central de comando
│   ├── educator/               # Painel educacional (CSV upload)
│   ├── escudo/                 # Escudo de dopamina
│   ├── essay/                  # Corretor de redação + redação por foto
│   ├── estatisticas/           # Desempenho por tópico
│   ├── foco/                   # Modo foco Pomodoro
│   ├── marketplace/            # Catálogo e agendamento de psicólogos
│   ├── notebook/               # Caderno de estudos
│   ├── overlays/               # Modais (Crise, Relatório Semanal, AI Studio)
│   ├── parent/                 # Painel dos pais
│   ├── profile/                # Perfil do usuário
│   ├── psicologo/              # Painel do psicólogo
│   ├── quiz/                   # Quiz adaptativo IA
│   ├── ranking/                # Ranking gamificado
│   └── store/                  # Loja do Sagui
├── shared/
│   ├── lib/                    # Engines (SSC, emoção, KB, planner, etc.)
│   ├── storage/                # Repositories (Supabase)
│   ├── ui/                     # Componentes reutilizáveis (Modal, Toast, GlassCard)
│   └── types.ts                # Tipos compartilhados
├── stores/
│   ├── appStore.ts             # Store global (sessão, chat, XP)
│   ├── bemEstarStore.ts        # Telemetria, foco offline, burnout
│   ├── marketplaceStore.ts     # Consultas e catálogo
│   ├── mascotStore.ts          # Estados do mascote Sagui
│   └── storeStore.ts           # Inventário da loja
└── styles/
    └── index.css               # Tailwind + estilos globais
```

### Roteamento

Sem React Router. A navegação é feita por estado Zustand (`activeTab` + `userRole`):

- `App.tsx` renderiza `AppShell` (aluno), `EducatorPage`, `ParentPage` ou `PsicologoPage` conforme `userRole`
- `AppShell` renderiza a página ativa via `switch (activeTab)`
- Tabs fixas na sidebar (desktop) e bottom nav (mobile)

## Getting Started

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Em produção nada disso vive num arquivo: as variáveis ficam no painel da
hospedagem (**Vercel → Settings → Environment Variables**) e o app as lê em
tempo de execução. Para desenvolver, `cp .env.example .env` — ou apenas
exporte as variáveis no terminal, que funciona igual.

| Variável               | Obrigatória | Vai ao navegador? | Descrição                                                        |
| ---------------------- | ----------- | ----------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`         | Sim         | Sim (é pública)   | URL raiz do projeto Supabase                                     |
| `SUPABASE_ANON_KEY`    | Sim         | Sim (é pública)   | Chave anon; quem protege os dados é a RLS                        |
| `AI_PROVIDER`          | Não         | Sim               | `deepseek` (padrão) ou `gemini`                                  |
| `AI_MODEL`             | Não         | Sim               | Modelo efetivo (ex.: `deepseek-v4-flash`)                        |
| `DEEPSEEK_API_KEY`     | Sim         | **Nunca**         | Chave do chat/quiz. Só o back-end (`/api/*`) a enxerga           |
| `GEMINI_API_KEY`       | Não         | **Nunca**         | Visão: redação por foto e OCR do caderno                         |
| `GOOGLE_TTS_KEY`       | Não         | **Nunca**         | Vozes neurais das Pílulas de Áudio                               |
| `SUPABASE_SERVICE_KEY` | Não         | **Nunca**         | Importação de turmas (ignora RLS)                                |
| `RESEND_API_KEY`       | Não         | **Nunca**         | Emails de boas-vindas da importação                              |
| `MP_ACCESS_TOKEN`      | Não         | **Nunca**         | Pagamento das consultas; sem ela, modo simulado                  |
| `N8N_WEBHOOK_URL`      | Não         | Sim               | Reserva para criação de contas (professor)                       |

**A regra que importa:** variável com prefixo `VITE_` é gravada dentro do
bundle durante o build e qualquer visitante lê com F12. Variável **sem** o
prefixo é lida só no servidor, dentro de `/api/*`. Por isso nenhum segredo
acima leva `VITE_`. As versões `VITE_*` continuam aceitas apenas como
reserva para hospedagem sem funções serverless (ver `.env.example`, seção 5).

Sem Supabase configurado, o login mostra aviso e o app não entra.

### 3. Aplicar o banco de dados

Rode nesta ordem no SQL Editor do Supabase (`SQL Editor > New query`, um por vez, esperando `Success`):

```
supabase/migrations/003_schema_completo.sql      # base (se o projeto ainda está vazio)
supabase/migrations/004_fix_recursao_ligas.sql
supabase/migrations/005_loja_compra_servidor.sql # loja com preço no banco
supabase/migrations/006_ligas_e_comunidade.sql   # ligas + mural da turma
supabase/migrations/007_entrada_por_codigo.sql   # entrar na turma por código
supabase/migrations/008_corrige_nivel.sql        # fórmula de nível
supabase/migrations/009_tarefa_idempotente.sql   # anti-farm de XP
supabase/migrations/010_bemestar_marketplace_foco.sql  # tabelas do bem-estar
supabase/migrations/011_bemestar_funcoes_rls.sql       # funções, RLS, seeds
supabase/migrations/012_persona_ativa_texto.sql
supabase/migrations/013_redacao_por_foto.sql      # bucket essay_scans
supabase/migrations/014_quiz_antirrepeticao.sql
supabase/migrations/015_quiz_desempenho.sql
supabase/migrations/016_conversas_chat.sql        # threads do chat
supabase/migrations/017_reiniciar_indice.sql
supabase/migrations/018_instituicao_convites.sql  # código da instituição
```

Atalho: a pasta `supabase/migrations/passo_a_passo/` tem os passos 0–5 fatiados
(diagnóstico + 005 a 009) para colar um por vez sem travar o editor.

### 4. Iniciar dev server

```bash
npm run dev
# → http://localhost:5173/
```

### 5. Build produção

```bash
npm run build
npm run preview
```

## Scripts

| Comando              | Ação                             |
| -------------------- | -------------------------------- |
| `npm run dev`        | Inicia servidor de desenvolvimento |
| `npm run build`      | Compila TS + Vite para produção   |
| `npm run preview`    | Serve o build localmente          |
| `npm run lint`       | Verifica código com Oxlint        |
| `npm test`           | Roda todos os testes (Vitest, 405)|
| `npm run test:watch` | Roda testes em modo watch         |

## Gamificação

- **XP** por atividades: quiz (+30/acerto), mensagens (+5), ligas (+35–40), redação, foco (teto por evento no servidor)
- **Níveis** com custo progressivo: subir ao nível L custa 100 × (L-1); acumulado = 50 × L × (L-1) (espelha `calcLevel()`)
- **Streak** por acesso diário consecutivo
- **SSC Score** (0–100) - Sono, Stress, Cansaço - calculado com base em inputs + emoção detectada

## Liga de Estudos

- Cada liga tem: disciplina, metas, desafio diário, chat em tempo real, XP
- Limite de 2 ligas por usuário
- Sala da liga com chat estilo WhatsApp:
  - Bolhas próprias à direita (verde)
  - Bolhas de outros à esquerda (cinza, com nome)
  - Notificações de entrada centralizadas
  - Auto-scroll para mensagens novas

## Quiz Adaptativo

- Questões geradas por IA (DeepSeek via back-end), 10 matérias × 10 tópicos cada
- **Antirrepetição**: enunciados já exibidos entram no prompt e no filtro, por matéria
- Flashcards vindos do Notebook AI Studio
- Histórico de desempenho por matéria e por tópico (tela de Estatísticas)

## API de IA

O padrão é **DeepSeek V4 Flash via back-end** — o navegador nunca chama a API
direto e a chave nunca vai ao bundle.

O back-end é `server/worker.js`, e **o mesmo arquivo roda nos três ambientes**
(não há duas implementações para divergir):

| Ambiente           | Quem executa                        | De onde vêm as variáveis     |
| ------------------ | ----------------------------------- | ---------------------------- |
| `npm run dev`      | middleware do Vite (`/api/*`)       | `.env` ou o shell            |
| Vercel (produção)  | Serverless Function (`/api/*`)      | Environment Variables        |
| Cloudflare Worker  | `wrangler deploy` (opcional)        | `wrangler secret`            |

O navegador sempre chama `/api/...` na **mesma origem** do site. Isso elimina
CORS, elimina o "Failed to fetch" por adblock e dispensa o `API_TOKEN` — não
existe origem terceira para barrar.

Rotas: `/api/config`, `/api/health`, `/api/generate`, `/api/tts`,
`/api/chat/completions`, `/api/ocr-process`, `/api/essays/upload-and-grade`,
`/api/turmas/import`, `/api/pagamento`.

### Publicar num Cloudflare Worker (opcional)

Só é necessário se você quiser o back-end **fora** da Vercel:

```bash
npx wrangler login
npx wrangler deploy server/worker.js --name midnight-mentor-ia
npx wrangler secret put DEEPSEEK_API_KEY  # chave do servidor
npx wrangler secret put API_TOKEN         # senha anti-abuso (vai no AI_PROXY_TOKEN)
```

Depois aponte o app para ele com `AI_BASE_URL=https://seu-worker.workers.dev`
e defina `ALLOWED_ORIGIN=https://seu-site` no worker, para que só o seu site
use a sua cota de IA.

### Fallback: chave do próprio usuário (Gemini)

Sem nenhum back-end alcançável, cada aluno cola a própria chave grátis do
[Google AI Studio](https://aistudio.google.com/apikey) no **Perfil**
(Provedor `gemini`).

- Sem nenhuma das opções, o app funciona **offline** (fallback local em chat/quiz/redação).

Usos:
- Geração de questões de quiz
- Resumo e mapa mental (Notebook AI Studio)
- Chat com persona do Mentor
- Análise de gaps de aprendizado

## Módulo de bem-estar (marketplace, foco offline, fadiga)

As funcionalidades dependem das migrações **010 e 011** (tabelas + funções/RLS/seeds),
rodadas **nesta ordem** no SQL Editor do Supabase, depois das 005–009.

Para cadastrar um profissional (a conta precisa existir no app antes):

```sql
select public.registrar_psicologo(
  'psicologa@exemplo.com', 'CRP 06/123456',
  'Atende adolescentes, foco em ansiedade de desempenho.',
  array['ansiedade','vestibular'], 120
);
```

Sem `MP_ACCESS_TOKEN` no worker, o pagamento entra em **modo
demonstração**: a consulta é confirmada na hora e a sala é criada, sem
cobrança. Confira em `GET /health` antes de publicar — em produção, essa
chave vazia é consulta de graça.

As migrações são verificadas automaticamente: `npm test` executa
`supabase/__tests__/migracoes.test.mjs`, que aplica os 16 arquivos SQL num
Postgres real (PGlite/WASM), cria usuários e confere RLS, constraints e
as fórmulas duplicadas entre banco e cliente. O worker tem o mesmo
tratamento em `server/__tests__/worker.test.mjs` e `deepseek.test.mjs`.

Detalhes de arquitetura e das decisões: [`docs/modulo-bem-estar.md`](docs/modulo-bem-estar.md)
e [`docs/chat-tematico-e-redacao-por-foto.md`](docs/chat-tematico-e-redacao-por-foto.md).
App nativo do Escudo de Dopamina: [`mobile/react-native/`](mobile/react-native/README.md).

## Segurança

- Toda variável `VITE_*` vai ao bundle: **nunca** coloque `service_role` ou
  `DEEPSEEK_API_KEY` com esse prefixo. Segredo mora em variável sem prefixo,
  lida só dentro de `/api/*`
- `/api/config` devolve exclusivamente configuração pública (URL e chave anon
  do Supabase, provedor/modelo). Das chaves de servidor ela informa apenas
  *se* estão configuradas — booleano, nunca o valor
- Cadastro sempre nasce `student`; promoção a educador/admin só pelo SQL Editor
- XP, loja, foco e burnout só por funções do servidor (`SECURITY DEFINER`)
- RLS ligada em todas as tabelas; nenhuma tabela sem policy passa no teste
- Foto de redação em bucket privado, por dono (`essay_scans/<uid>/...`)

## Deploy

### Vercel (recomendado)

O repositório já traz `vercel.json` e as funções em `api/`. O fluxo é:

1. Importe o repositório na Vercel (ela detecta Vite sozinha).
2. Em **Settings → Environment Variables**, cadastre as variáveis da tabela
   do *Getting Started*. No mínimo: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
   `DEEPSEEK_API_KEY`.
3. Deploy.

Verifique com `https://seu-app.vercel.app/api/health` — ele responde quais
recursos estão ligados (`deepseek`, `tts`, `email`, `pagamento`) sem
revelar nenhuma chave.

**Mudou uma variável no painel?** Configuração pública (Supabase, provedor,
modelo) passa a valer no próximo carregamento da página, sem rebuild —
`/api/config` é lida a cada requisição. Chave de servidor exige um novo
deploy, porque a função precisa reiniciar para recebê-la.

### Outras hospedagens

Em host **com** funções serverless, o mesmo arranjo vale. Em host
**estático puro** (GitHub Pages), `/api/*` não existe: publique o worker no
Cloudflare, aponte `AI_BASE_URL` para ele e preencha as variáveis `VITE_*`
de reserva antes do build (elas ficam congeladas no bundle).

```bash
npm run build
# dist/ → deploy
```

## Licença

Projeto educacional de código aberto.
