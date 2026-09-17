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

## Testes

Vitest. A lógica pura de `shared/lib/` é o que tem cobertura — mantenha a
lógica nova lá em vez de dentro do componente. Testes que mexem em env usam
`vi.resetModules()` + `vi.stubEnv()` + import dinâmico; leitura por função é
compatível com esse padrão.

`server/__tests__/` cobre o worker com Node puro.

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
