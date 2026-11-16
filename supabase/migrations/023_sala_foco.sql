-- =====================================================================
-- SALA DE FOCO (body doubling) — presenca assincrona de quem estuda
--
-- O QUE RESOLVE
--   Estudar sozinho a noite e o que faz o aluno do noturno desistir. A
--   sala mostra quem da MESMA ESCOLA esta focando agora — presenca, nao
--   conversa. Nao existe chat aqui nem na tabela: nao ha coluna de texto
--   para mensagem, de proposito.
--
-- COMO A PRESENCA FUNCIONA
--   Heartbeat. O app chama `pingar_sala_foco` a cada ~45s; quem para de
--   pingar desaparece da listagem em 2 minutos. Fechar a aba no 4G nem
--   sempre manda o adeus, entao "saiu" nunca pode depender do adeus.
--
-- PRIVACIDADE
--   - E OPT-IN: so aparece quem chamou `entrar_sala_foco`.
--   - A listagem devolve PRIMEIRO NOME + inicial (nunca nome completo,
--     nunca email, nunca id do usuario).
--   - Escopo = escola. Conta sem escola vinculada ve apenas a si mesma:
--     sem isso, todo mundo sem escola cairia numa sala publica com
--     desconhecidos, que e exatamente o que nao se oferece a menor.
--   - A tabela nao e legivel direto (RLS so libera a propria linha); a
--     lista sai por funcao SECURITY DEFINER, que decide o que mostrar.
--
-- Idempotente. Rode depois da 022.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Tabela de presenca (uma linha viva por pessoa)
-- ---------------------------------------------------------------------
create table if not exists public.sala_foco_presenca (
  user_id      uuid primary key references public.perfis(id) on delete cascade,
  escola_id    uuid references public.escolas(id) on delete cascade,
  materia      text not null default '',
  minutos_foco integer not null default 0 check (minutos_foco >= 0),
  entrou_em    timestamptz not null default now(),
  ultimo_ping  timestamptz not null default now()
);
create index if not exists sala_foco_escola_idx
  on public.sala_foco_presenca (escola_id, ultimo_ping desc);

alter table public.sala_foco_presenca enable row level security;

-- Dono mexe so na propria linha. LEITURA tambem e so da propria linha:
-- ver os colegas passa obrigatoriamente por listar_sala_foco(), que
-- limita o que sai (nome curto, sem id, so quem esta presente).
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'sala_foco_sel' and tablename = 'sala_foco_presenca') then
    create policy sala_foco_sel on public.sala_foco_presenca
      for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'sala_foco_ins' and tablename = 'sala_foco_presenca') then
    create policy sala_foco_ins on public.sala_foco_presenca
      for insert with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'sala_foco_upd' and tablename = 'sala_foco_presenca') then
    create policy sala_foco_upd on public.sala_foco_presenca
      for update using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'sala_foco_del' and tablename = 'sala_foco_presenca') then
    create policy sala_foco_del on public.sala_foco_presenca
      for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Entrar / pingar / sair
-- ---------------------------------------------------------------------
create or replace function public.entrar_sala_foco(p_materia text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_escola uuid;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select escola_id into v_escola from public.perfis where id = v_user;

  insert into public.sala_foco_presenca (user_id, escola_id, materia, minutos_foco, entrou_em, ultimo_ping)
  values (v_user, v_escola, left(coalesce(p_materia, ''), 40), 0, now(), now())
  on conflict (user_id) do update
    -- Reentrar zera o cronometro da sessao: o que a sala mostra e "ha
    -- quanto tempo esta focando AGORA", nao um total historico.
    set escola_id = excluded.escola_id,
        materia = excluded.materia,
        minutos_foco = 0,
        entrou_em = now(),
        ultimo_ping = now();
end $$;

create or replace function public.pingar_sala_foco(p_minutos integer default 0)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  update public.sala_foco_presenca
     set ultimo_ping = now(),
         -- Nunca anda para tras: um ping fora de ordem (4G) nao pode
         -- encolher o tempo de foco ja mostrado aos colegas. Teto de
         -- 12h mata o contador da aba esquecida aberta a noite toda.
         minutos_foco = greatest(minutos_foco, least(greatest(coalesce(p_minutos, 0), 0), 720))
   where user_id = v_user;
end $$;

create or replace function public.sair_sala_foco()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  delete from public.sala_foco_presenca where user_id = v_user;
end $$;

-- ---------------------------------------------------------------------
-- Listagem (o unico caminho para ver os colegas)
-- ---------------------------------------------------------------------
create or replace function public.listar_sala_foco()
returns table (
  nome text,
  avatar_url text,
  materia text,
  minutos_foco integer,
  entrou_em timestamptz,
  ultimo_ping timestamptz,
  eh_voce boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_escola uuid;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select escola_id into v_escola from public.perfis where id = v_user;

  return query
  select
    -- Primeiro nome + inicial do sobrenome. O nome completo nunca sai
    -- do banco por aqui; o front apenas formata o que ja chega curto.
    trim(split_part(p.nome, ' ', 1) ||
         case when coalesce(p.sobrenome, '') <> ''
              then ' ' || upper(left(p.sobrenome, 1)) || '.'
              when position(' ' in trim(p.nome)) > 0
              then ' ' || upper(left(split_part(trim(p.nome), ' ', 2), 1)) || '.'
              else '' end)::text,
    p.avatar_url::text,
    s.materia,
    s.minutos_foco,
    s.entrou_em,
    s.ultimo_ping,
    (s.user_id = v_user)
  from public.sala_foco_presenca s
  join public.perfis p on p.id = s.user_id
  where s.ultimo_ping >= now() - interval '2 minutes'
    and (
      s.user_id = v_user
      -- Conta sem escola so enxerga a si mesma: sala publica com
      -- desconhecidos nao e coisa que se ofereca a adolescente.
      or (v_escola is not null and s.escola_id = v_escola)
    )
  order by (s.user_id = v_user), s.minutos_foco desc
  limit 60;
end $$;

comment on table public.sala_foco_presenca is
  'Body doubling: presenca efemera de quem esta focando. Sem chat, por desenho.';

revoke all on function public.entrar_sala_foco(text)   from public, anon;
revoke all on function public.pingar_sala_foco(integer) from public, anon;
revoke all on function public.sair_sala_foco()          from public, anon;
revoke all on function public.listar_sala_foco()        from public, anon;
grant execute on function public.entrar_sala_foco(text)    to authenticated;
grant execute on function public.pingar_sala_foco(integer) to authenticated;
grant execute on function public.sair_sala_foco()          to authenticated;
grant execute on function public.listar_sala_foco()        to authenticated;

commit;

-- =====================================================================
-- Verificacao:
--   select public.entrar_sala_foco('Matemática');
--   select * from public.listar_sala_foco();
--   select public.pingar_sala_foco(12);
--   select public.sair_sala_foco();
-- Linha parada ha mais de 2 min nao deve aparecer na listagem.
-- =====================================================================
