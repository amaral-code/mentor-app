-- =====================================================================
-- Ampli-IA - QUIZ ANTIRREPETICAO (historico de questoes exibidas)
--
-- Cada questao que aparece na tela e registrada com o hash normalizado
-- do enunciado (minusculas, sem pontuacao). Na geracao seguinte, o
-- historico da materia entra no prompt do modelo ("nao repita nem
-- reformule") e o front filtra duplicadas pelo mesmo hash.
--
-- Unicidade por (user_id, enunciado_hash): a mesma questao nunca entra
-- duas vezes para a mesma conta, mesmo com duplo-clique, retry de rede
-- ou duas abas gerando ao mesmo tempo - o upsert pelo conflito resolve
-- sem erro.
--
-- Idempotente. Rode depois da 013.
-- =====================================================================

begin;

create table if not exists public.quiz_questoes_exibidas (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.perfis(id) on delete cascade,
  materia           text not null,
  topico            text,
  enunciado_hash    text not null,
  enunciado_preview text not null,
  dificuldade       text not null default 'media'
    check (dificuldade in ('facil', 'media', 'dificil')),
  criado_em         timestamptz not null default now(),
  constraint quiz_questao_unica_por_usuario unique (user_id, enunciado_hash)
);

create index if not exists quiz_exibidas_user_idx
  on public.quiz_questoes_exibidas (user_id, materia, criado_em desc);

alter table public.quiz_questoes_exibidas enable row level security;

-- Dono total: le, grava e apaga so o proprio historico. Sem acesso de
-- responsavel/educador: o que foi perguntado a quem e dado do aluno.
drop policy if exists quiz_exibidas_sel on public.quiz_questoes_exibidas;
create policy quiz_exibidas_sel on public.quiz_questoes_exibidas for select
  using ((select auth.uid()) = user_id);

drop policy if exists quiz_exibidas_ins on public.quiz_questoes_exibidas;
create policy quiz_exibidas_ins on public.quiz_questoes_exibidas for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists quiz_exibidas_del on public.quiz_questoes_exibidas;
create policy quiz_exibidas_del on public.quiz_questoes_exibidas for delete
  using ((select auth.uid()) = user_id);

comment on table public.quiz_questoes_exibidas is 'Enunciados ja exibidos em quiz, por conta: base do antirrepeticao por materia/conteudo.';

commit;
