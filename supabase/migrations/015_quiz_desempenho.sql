-- =====================================================================
-- Ampli-IA - QUIZ DESEMPENHO POR TOPICO (base do Analytics)
--
-- Placar acumulado de acertos/erros por (conta, materia, topico).
-- A escrita passa SEMPRE pela funcao registrar_desempenho_topico():
-- ela resolve o dono pelo JWT (auth.uid(), nao pelo que o cliente
-- manda) e incrementa de forma atomica - duas abas respondendo ao
-- mesmo tempo nao perdem contagem.
--
-- Leitura direta liberada so para o dono (tela de Estatisticas).
-- Escrita direta bloqueada (sem policy de insert): forca o RPC.
--
-- Idempotente. Rode depois da 014.
-- =====================================================================

begin;

-- topico vazio ('') em vez de NULL de proposito: NULL nao conflita
-- em unique do Postgres, e cada resposta sem topico viraria uma linha
-- nova em vez de somar no placar.
create table if not exists public.quiz_desempenho_topicos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.perfis(id) on delete cascade,
  materia     text not null,
  topico      text not null default '',
  acertos     integer not null default 0 check (acertos >= 0),
  erros       integer not null default 0 check (erros >= 0),
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint quiz_desempenho_unico_por_topico unique (user_id, materia, topico)
);

create index if not exists quiz_desempenho_user_idx
  on public.quiz_desempenho_topicos (user_id, materia, atualizado_em desc);

alter table public.quiz_desempenho_topicos enable row level security;

-- So leitura do dono. SEM policy de insert/update/delete: escrever
-- direto e proibido, o caminho e a funcao abaixo.
drop policy if exists quiz_desempenho_sel on public.quiz_desempenho_topicos;
create policy quiz_desempenho_sel on public.quiz_desempenho_topicos for select
  using ((select auth.uid()) = user_id);

drop policy if exists quiz_desempenho_del on public.quiz_desempenho_topicos;
create policy quiz_desempenho_del on public.quiz_desempenho_topicos for delete
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- registrar_desempenho_topico(materia, topico, acertou)
-- Soma 1 em acertos ou erros, criando a linha quando e o primeiro
-- registro do topico. SECURITY DEFINER com search_path travado, como
-- as demais funcoes de escrita do projeto.
-- ---------------------------------------------------------------------
create or replace function public.registrar_desempenho_topico(
  p_materia text,
  p_topico  text,
  p_acertou boolean
)
returns public.quiz_desempenho_topicos
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_topico text := coalesce(nullif(btrim(p_topico), ''), '');
  v_row    public.quiz_desempenho_topicos;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_materia is null or btrim(p_materia) = '' then raise exception 'materia ausente'; end if;

  insert into public.quiz_desempenho_topicos (user_id, materia, topico, acertos, erros)
  values (v_user, btrim(p_materia), v_topico, case when p_acertou then 1 else 0 end, case when p_acertou then 0 else 1 end)
  on conflict (user_id, materia, topico)
  do update set
    acertos = public.quiz_desempenho_topicos.acertos + case when p_acertou then 1 else 0 end,
    erros = public.quiz_desempenho_topicos.erros + case when p_acertou then 0 else 1 end,
    atualizado_em = now()
  returning * into v_row;

  return v_row;
end $$;

comment on table public.quiz_desempenho_topicos is 'Placar de acertos/erros por topico, por conta: base da tela de Estatisticas.';
comment on function public.registrar_desempenho_topico(text, text, boolean) is 'Incremento atomico do placar do topico; dono resolvido pelo JWT.';

commit;
