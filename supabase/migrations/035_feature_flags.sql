-- =====================================================================
-- 035 — Feature flags com rollout por porcentagem e por escola (#69, M7)
-- =====================================================================
--
-- Ligar uma funcionalidade para parte dos alunos SEM nova build: a flag
-- mora numa tabela, e o app pergunta `minhas_flags()` ao abrir.
--
-- COMO O SORTEIO FUNCIONA
--   Cada pessoa cai num "balde" de 0 a 99, calculado do id da conta com
--   o nome da flag. É determinístico: a mesma pessoa vê sempre a mesma
--   coisa (sem piscar entre versões), e subir de 10% para 30% mantém os
--   10% que já tinham. O nome da flag entra no cálculo para que os 10%
--   de uma flag não sejam sempre os mesmos 10% de todas.
--
-- ESCOLAS
--   `escolas` vazia = vale para todos. Preenchida = só alunos e equipe
--   daquelas escolas (piloto com escola parceira, #74).
--
-- Quem liga e desliga é a equipe, pelo SQL Editor ou pelo painel do
-- Supabase. O app só lê o resultado para a própria conta.
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

create table if not exists public.feature_flags (
  chave         text primary key check (chave ~ '^[a-z0-9_]{2,40}$'),
  descricao     text not null default '',
  ativa         boolean not null default false,
  porcentagem   smallint not null default 0 check (porcentagem between 0 and 100),
  escolas       uuid[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

-- Ninguém lê a tabela direto: a lista de escolas de um piloto não é
-- assunto de aluno. O app só recebe as chaves ligadas para ele.
alter table public.feature_flags enable row level security;

create or replace function public.balde_da_flag(p_user uuid, p_chave text)
returns integer
language sql immutable as $$
  select (('x' || substr(md5(p_user::text || ':' || p_chave), 1, 8))::bit(32)::bigint % 100)::integer
$$;

create or replace function public.minhas_flags()
returns setof text
language sql stable security definer set search_path = public as $$
  select f.chave
    from public.feature_flags f
   where f.ativa
     and (select auth.uid()) is not null
     and public.balde_da_flag((select auth.uid()), f.chave) < f.porcentagem
     and (
       cardinality(f.escolas) = 0
       or (select p.escola_id from public.perfis p where p.id = (select auth.uid())) = any (f.escolas)
     )
$$;

revoke all on function public.minhas_flags() from public, anon;
grant execute on function public.minhas_flags() to authenticated;

commit;

-- =====================================================================
-- Exemplo: ligar o "quiz_5_alternativas" para 10% dos alunos.
--   insert into public.feature_flags (chave, descricao, ativa, porcentagem)
--   values ('quiz_5_alternativas', 'Quiz com 5 alternativas, como o ENEM', true, 10)
--   on conflict (chave) do update set ativa = true, porcentagem = 10, atualizado_em = now();
-- =====================================================================
