# Ambientes: dev, staging e produção

O app guarda dados de adolescentes. Por isso **ninguém desenvolve nem testa em produção**.

O back-end é `server/worker.js` e roda igual nos três lugares (veja "API de IA" no README):
middleware do Vite em dev, Serverless Functions (`/api/*`) na Vercel e, opcionalmente, um Cloudflare Worker.

| | Dev (local) | Staging (Preview) | Produção |
| --- | --- | --- | --- |
| Para quê | Cada pessoa desenvolve na própria máquina | Cada PR ganha um link de teste; demos | Alunos reais |
| Onde roda | `npm run dev` (front + `/api` no Vite) | Vercel **Preview** (deploy automático de cada branch/PR) | Vercel **Production** (merge na `main`) |
| Supabase | `npx supabase start` (Docker) ou projeto dev compartilhado | Projeto `mentor-staging` | Projeto de produção |
| Variáveis | `.env` (copie de `.env.example`) | Vercel → Settings → Environment Variables → **Preview** | Vercel → Settings → Environment Variables → **Production** |
| Dados | Fictícios | Fictícios | Reais (acesso restrito) |

A regra mais importante: **as variáveis de Preview apontam para o Supabase de staging**.
Assim um PR em teste nunca escreve no banco dos alunos.

Todos os arquivos `.env*` e `.dev.vars` são ignorados pelo git. Os valores reais ficam **no cofre de senhas da equipe**.

## Começando (dev)

```bash
cp .env.example .env               # preencha com as chaves de DEV
npx supabase start                 # Postgres + Auth locais (precisa de Docker)
bash scripts/migrar.sh local       # aplica as migrations
npm run dev                        # front + /api na mesma porta
```

Sem Docker? Use o projeto Supabase de dev compartilhado e coloque a URL e as chaves dele no `.env`.

## Fluxo de uma mudança no banco

1. Crie `supabase/migrations/0NN_descricao.sql` com o próximo número livre.
2. Adicione o teste em `supabase/__tests__`. O CI roda todas as migrations num Postgres real com PGlite.
3. Antes de testar o PR no link de Preview, rode `bash scripts/migrar.sh staging`.
4. Depois do merge na `main`, rode `bash scripts/migrar.sh production` (o script pede confirmação).

> Os bancos atuais receberam as migrations à mão, pelo SQL Editor. Antes do primeiro
> `migrar.sh` em cada banco, rode uma vez
> `npx supabase migration repair --status applied <versões já aplicadas>`.
> `PENDENTES_rodar_tudo.sql` e a pasta `passo_a_passo/` são roteiros antigos. O CLI ignora esses arquivos.

## Cloudflare Worker (opcional)

Só é necessário se o back-end precisar rodar **fora** da Vercel. O `wrangler.toml` tem os três ambientes:

```bash
cp .dev.vars.example .dev.vars && npx wrangler dev   # dev
npm run deploy:worker:staging                          # midnight-mentor-ia-staging
npm run deploy:worker:prod                             # midnight-mentor-ia
```

`npx wrangler deploy` **sem** `--env` publica o worker de dev, nunca o de produção.
Para cadastrar os segredos de cada ambiente, use `npx wrangler secret put <NOME> --env staging|production`.

## Scripts de depuração (`tools/`)

Esses scripts usam a chave `service_role`, que ignora a RLS e cria e apaga usuários. **Rode só contra dev ou staging:**

```bash
SUPABASE_URL=https://<projeto-staging>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role de staging> \
node tools/debug_login.mjs http://localhost:5173
```

## O que só o dono das contas pode fazer

- [ ] Criar o projeto Supabase de staging. Crie também um de dev compartilhado, se a equipe não usar Docker.
- [ ] Na Vercel, separar as variáveis por ambiente: **Preview** → Supabase de staging, **Production** → Supabase de produção.
- [ ] Guardar os valores no cofre de senhas da equipe.
- [ ] Se usar o worker da Cloudflare, trocar `ALLOWED_ORIGIN` em `wrangler.toml` pelos domínios finais.
