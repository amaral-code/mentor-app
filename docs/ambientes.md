# Ambientes: dev, staging e produção

O app guarda dados de adolescentes. Por isso **ninguém desenvolve nem testa em produção**.

| | Dev (local) | Staging | Produção |
| --- | --- | --- | --- |
| Para quê | Cada pessoa desenvolve na própria máquina | Testar a `main` antes de liberar; demos | Alunos reais |
| Supabase | `npx supabase start` (Docker) ou projeto dev compartilhado | Projeto `mentor-staging` | Projeto de produção |
| Worker de IA | `npx wrangler dev` | `midnight-mentor-ia-staging` | `midnight-mentor-ia` |
| Front | `npm run dev` | `npm run build:staging` | `npm run build` |
| Variáveis do front | `.env` | `.env.staging` | `.env.production` |
| Segredos do worker | `.dev.vars` | `wrangler secret put X --env staging` | `wrangler secret put X --env production` |
| Dados | Fictícios | Fictícios | Reais (acesso restrito) |

Todos os arquivos `.env*` e `.dev.vars` são ignorados pelo git. Os modelos versionados são
`.env.example` e `.dev.vars.example`. Os valores reais ficam **no cofre de senhas da equipe**.

## Começando (dev)

```bash
cp .env.example .env               # front
cp .dev.vars.example .dev.vars     # worker
npx supabase start                 # Postgres + Auth locais (precisa de Docker)
bash scripts/migrar.sh local       # aplica as migrations
npm run dev                        # front
npx wrangler dev                   # worker (outro terminal)
```

Sem Docker? Use o projeto Supabase de dev compartilhado e coloque URL e chaves dele no `.env`.

## Fluxo de uma mudança no banco

1. Crie `supabase/migrations/0NN_descricao.sql` (próximo número livre).
2. Adicione o teste em `supabase/__tests__` (o CI roda todas as migrations num Postgres real com PGlite).
3. Depois do merge na `main`: `bash scripts/migrar.sh staging` e teste o app de staging.
4. Só então: `bash scripts/migrar.sh production` (pede confirmação).

> Os bancos atuais receberam as migrations à mão pelo SQL Editor. Antes do primeiro
> `migrar.sh` em cada um, rode uma vez
> `npx supabase migration repair --status applied <versões já aplicadas>`.
> `PENDENTES_rodar_tudo.sql` e a pasta `passo_a_passo/` são roteiros antigos e o CLI ignora esses arquivos.

## Deploy do worker

```bash
npx wrangler deploy --env staging
npx wrangler deploy --env production
```

`npx wrangler deploy` **sem** `--env` publica o worker de dev, nunca o de produção.

## Scripts de depuração (`tools/`)

Usam a chave `service_role`, que ignora a RLS e cria/apaga usuários. **Rode só contra dev ou staging:**

```bash
SUPABASE_URL=https://<projeto-staging>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role de staging> \
node tools/debug_login.mjs http://localhost:5173
```

## O que só o dono das contas pode fazer

- [ ] Criar o projeto Supabase de staging (e um de dev compartilhado, se a equipe não usar Docker)
- [ ] Cadastrar os segredos do worker de staging (`wrangler secret put ... --env staging`)
- [ ] Criar `.env.staging` / `.env.production` e guardar os valores no cofre da equipe
- [ ] Trocar `ALLOWED_ORIGIN` em `wrangler.toml` pelos domínios finais
