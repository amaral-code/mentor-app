# @mentor/api

Acesso a dados do Midnight Mentor: cliente Supabase, repositórios e serviços que falam com o back-end. É compartilhado entre o app web e o mobile, e depende de `@mentor/core`.

## Como importar

```ts
import { getSupabase, configurarSupabase } from '@mentor/api/supabase';
import { acompanhamentoRepository } from '@mentor/api/AcompanhamentoRepository';
import type { Tables, LinhaRpc } from '@mentor/api/tiposBanco';
```

## Cliente por plataforma

No web, nada precisa ser configurado: a sessão fica no `localStorage` e o link mágico é lido da URL.

No mobile, chame no boot, antes de qualquer tela:

```ts
configurarSupabase({
  storage: armazenamentoSeguro,  // expo-secure-store / AsyncStorage
  detectSessionInUrl: false,     // o link mágico chega pelo deep link
});
```

URL e chave anon vêm de `@mentor/core/runtimeConfig`. Elas nunca são constantes de módulo.

## Tipos do banco

`src/database.types.ts` é **gerado** a partir de `supabase/migrations`, aplicadas num Postgres em memória (PGlite) com o mesmo setup dos testes de migration (`supabase/bancoLocal.mjs`). Isso não exige Docker nem acesso ao projeto Supabase.

```bash
npm run gen:types      # depois de criar ou alterar uma migration
npm run check:types    # o CI roda este e falha se o arquivo estiver velho
```

Migration nova? Acrescente o arquivo em `MIGRACOES`, dentro de `supabase/bancoLocal.mjs`, e rode `gen:types`.

Nos repositórios, tipe a linha crua com `LinhaRpc<'nome_da_funcao'>` ou `Tables<'tabela'>` em vez de `any`. Se a migration mudar uma coluna, o `tsc` aponta o repositório que ficou para trás.

O cliente ainda não é tipado (`createClient<Database>`). A troca será feita repositório a repositório.

## Regras

- Sem `window`, `document`, `localStorage` ou `navigator`: este pacote roda no React Native (o lint bloqueia).
- Toda tabela nova precisa de RLS e de teste em `supabase/__tests__`.
- A `service_role` nunca entra aqui: este código roda no aparelho do aluno.
