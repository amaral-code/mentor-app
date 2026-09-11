-- =====================================================================
-- MODO FOCO CONSCIENTE — métricas de atenção (focus_metrics)
--
-- Guarda, por sessão de estudo encerrada: minutos de foco contínuo
-- (cronômetro com aba visível) e quantas perdas de foco (mudanças de
-- aba via `visibilitychange`) aconteceram.
--
-- Segue o padrão do 003: escrita só pelo dono (RLS "dono faz tudo no
-- que é seu") + leitura liberada ao responsável vinculado (011) e ao
-- educador da mesma escola. Rode no SQL Editor. Idempotente.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------
create table if not exists public.focus_metrics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.perfis(id) on delete cascade,
  session_date      date not null default CURRENT_DATE,
  focused_minutes   integer not null default 0 check (focused_minutes >= 0),
  distraction_count integer not null default 0 check (distraction_count >= 0),
  criado_em         timestamptz not null default now()
);
create index if not exists focus_metrics_user_idx
  on public.focus_metrics (user_id, session_date desc);

alter table public.focus_metrics enable row level security;

-- Dono faz tudo no que é seu (mesmo molde do 003, sem o loop).
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'focus_metrics_sel' and tablename = 'focus_metrics') then
    create policy focus_metrics_sel on public.focus_metrics
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'focus_metrics_ins' and tablename = 'focus_metrics') then
    create policy focus_metrics_ins on public.focus_metrics
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'focus_metrics_upd' and tablename = 'focus_metrics') then
    create policy focus_metrics_upd on public.focus_metrics
      for update using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'focus_metrics_del' and tablename = 'focus_metrics') then
    create policy focus_metrics_del on public.focus_metrics
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

-- Responsável vinculado enxerga (leitura) as métricas do aluno — mesmo
-- molde de `foco_sel_responsavel` (011). Só existe se a função existir.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'sou_responsavel_de') then
    if not exists (select 1 from pg_policies where policyname = 'focus_metrics_sel_responsavel' and tablename = 'focus_metrics') then
      create policy focus_metrics_sel_responsavel on public.focus_metrics
        for select using (public.sou_responsavel_de(user_id));
    end if;
  end if;
end $$;

-- Educador da mesma escola acompanha (leitura) — mesmo molde de
-- `logs_educador_sel` (003). Só existe se as funções existirem.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'sou_educador')
     and exists (select 1 from pg_proc where proname = 'minha_escola_id') then
    if not exists (select 1 from pg_policies where policyname = 'focus_metrics_educador_sel' and tablename = 'focus_metrics') then
      create policy focus_metrics_educador_sel on public.focus_metrics
        for select using (
          public.sou_educador()
          and exists (select 1 from public.perfis p
                       where p.id = focus_metrics.user_id
                         and p.escola_id = public.minha_escola_id())
        );
    end if;
  end if;
end $$;

commit;

-- =====================================================================
-- Verificação:
--   select * from public.focus_metrics order by criado_em desc limit 10;
-- =====================================================================
