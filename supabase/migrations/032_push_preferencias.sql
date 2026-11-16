-- =====================================================================
-- 032 — Push no navegador, preferências e lembretes (issue #55, M5)
-- =====================================================================
--
-- O QUE JÁ EXISTIA
--   O canal 'push' existe desde a 010 e `notificar_responsaveis` (011) já
--   enfileira um push por alerta. Só que nada ENVIAVA push: a fila
--   crescia sem ninguém ler, e o alerta de saúde ao responsável chegava,
--   no máximo, por e-mail.
--
-- O QUE ESTA MIGRATION FAZ
--   1. `push_inscricoes`: uma linha por navegador/aparelho que aceitou
--      receber notificação (Web Push). O endpoint é o que o navegador
--      entrega; as chaves cifram o conteúdo para aquele aparelho.
--   2. `preferencias_notificacao`: o aluno controla cada tipo, o horário
--      silencioso e o limite por dia. Sem linha, valem os padrões.
--   3. `lembretes_do_dia(tipo)`: enfileira os lembretes (revisão que
--      vence hoje, ofensiva em risco). Só o servidor chama.
--   4. `pushes_para_enviar(limite)`: devolve o que pode sair AGORA e
--      descarta o que não pode, com o motivo gravado. As regras moram
--      aqui, e não no worker, para valerem em qualquer ambiente e serem
--      testadas no mesmo Postgres dos outros testes.
--
-- REGRAS (decisões de produto)
--   • Horário silencioso (padrão 22h às 7h de Brasília): o push ESPERA,
--     não é descartado. Sai quando o silêncio acaba.
--   • Limite diário (padrão 3): o que passa do limite é descartado.
--     Lembrete que chega no dia seguinte já não serve.
--   • Alerta de saúde ao responsável não conta no limite e não expira:
--     é o único que não pode se perder. Respeita o silêncio mesmo assim:
--     o índice de cansaço não é emergência, e acordar alguém às 3h por
--     ele não ajuda ninguém.
--   • Lembrete com mais de 24h na fila é descartado ("expirado").
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Motivo de descarte na fila
-- ---------------------------------------------------------------------
alter table public.notificacoes add column if not exists descartada text;

comment on column public.notificacoes.descartada is
  'Por que a notificação não foi enviada (desativada, limite diário, expirada, sem aparelho). NULL = enviada ou ainda na fila.';

-- ---------------------------------------------------------------------
-- 2. Inscrições de push (uma por navegador ou aparelho)
-- ---------------------------------------------------------------------
create table if not exists public.push_inscricoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.perfis(id) on delete cascade,
  endpoint      text not null unique check (endpoint ~ '^https://'),
  p256dh        text not null check (length(p256dh) between 80 and 100),
  auth          text not null check (length(auth) between 20 and 30),
  user_agent    text,
  criado_em     timestamptz not null default now(),
  ultimo_uso_em timestamptz
);
create index if not exists push_inscricoes_user_idx on public.push_inscricoes (user_id);

-- A 010 criou `push_assinaturas` com o mesmo papel, mas nenhuma tela
-- gravava nela. O que houver é copiado para cá, e ela fica marcada como
-- substituída (não é apagada: apagar tabela não se desfaz).
insert into public.push_inscricoes (user_id, endpoint, p256dh, auth, user_agent)
select a.user_id, a.endpoint, a.p256dh, a.auth, a.user_agent
  from public.push_assinaturas a
 where a.endpoint ~ '^https://'
   and length(a.p256dh) between 80 and 100
   and length(a.auth) between 20 and 30
on conflict (endpoint) do nothing;

comment on table public.push_assinaturas is
  'SUBSTITUÍDA por push_inscricoes (migration 032). Não usar; pode ser apagada depois de conferir que está vazia.';

alter table public.push_inscricoes enable row level security;

-- Ler e apagar a própria. Gravar só pela função: o endpoint é único, e
-- quem trocar de conta no mesmo navegador precisa ASSUMIR a inscrição,
-- coisa que um insert comum recusaria e um upsert com RLS não alcança.
drop policy if exists push_sel on public.push_inscricoes;
create policy push_sel on public.push_inscricoes for select using ((select auth.uid()) = user_id);
drop policy if exists push_del on public.push_inscricoes;
create policy push_del on public.push_inscricoes for delete using ((select auth.uid()) = user_id);
grant select, delete on public.push_inscricoes to authenticated;

create or replace function public.salvar_inscricao_push(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;

  insert into public.push_inscricoes (user_id, endpoint, p256dh, auth, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update
     set user_id    = excluded.user_id,
         p256dh     = excluded.p256dh,
         auth       = excluded.auth,
         user_agent = excluded.user_agent
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.salvar_inscricao_push(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Preferências
-- ---------------------------------------------------------------------
create table if not exists public.preferencias_notificacao (
  user_id         uuid primary key references public.perfis(id) on delete cascade,
  tipos           jsonb not null default '{}',
  silencio_inicio smallint not null default 22 check (silencio_inicio between 0 and 23),
  silencio_fim    smallint not null default 7  check (silencio_fim between 0 and 23),
  limite_diario   smallint not null default 3  check (limite_diario between 1 and 10),
  atualizado_em   timestamptz not null default now()
);

alter table public.preferencias_notificacao enable row level security;
drop policy if exists prefnot_sel on public.preferencias_notificacao;
create policy prefnot_sel on public.preferencias_notificacao for select using ((select auth.uid()) = user_id);
grant select on public.preferencias_notificacao to authenticated;

create or replace function public.salvar_preferencias_notificacao(
  p_tipos           jsonb,
  p_silencio_inicio integer,
  p_silencio_fim    integer,
  p_limite_diario   integer
)
returns public.preferencias_notificacao
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := (select auth.uid());
  v_tipos jsonb := '{}';
  v_chave text;
  v_row   public.preferencias_notificacao;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;

  -- Só as chaves conhecidas, só booleanos. O resto é ignorado em vez de
  -- gravado: jsonb livre vindo do cliente vira lixo no banco.
  foreach v_chave in array array['revisao','ofensiva','liga','consulta','mensagens','alerta','relatorio'] loop
    if jsonb_typeof(p_tipos -> v_chave) = 'boolean' then
      v_tipos := v_tipos || jsonb_build_object(v_chave, p_tipos -> v_chave);
    end if;
  end loop;

  insert into public.preferencias_notificacao (user_id, tipos, silencio_inicio, silencio_fim, limite_diario, atualizado_em)
  values (
    v_user, v_tipos,
    greatest(0, least(23, coalesce(p_silencio_inicio, 22))),
    greatest(0, least(23, coalesce(p_silencio_fim, 7))),
    greatest(1, least(10, coalesce(p_limite_diario, 3))),
    now()
  )
  on conflict (user_id) do update
     set tipos = excluded.tipos,
         silencio_inicio = excluded.silencio_inicio,
         silencio_fim = excluded.silencio_fim,
         limite_diario = excluded.limite_diario,
         atualizado_em = now()
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.salvar_preferencias_notificacao(jsonb, integer, integer, integer) to authenticated;

-- Tipo da notificação -> chave da preferência.
create or replace function public.chave_preferencia_notificacao(p_tipo text)
returns text
language sql immutable as $$
  select case
    when p_tipo like 'alerta%' then 'alerta'
    when p_tipo in ('revisao') then 'revisao'
    when p_tipo in ('ofensiva') then 'ofensiva'
    when p_tipo like 'liga%' then 'liga'
    when p_tipo in ('consulta') then 'consulta'
    when p_tipo in ('mensagem_apoio', 'vinculo', 'consentimento') then 'mensagens'
    when p_tipo like 'relatorio%' then 'relatorio'
    else 'outros'
  end
$$;

-- ---------------------------------------------------------------------
-- 4. Avisos que já nascem no app também viram push
--
--    Mensagem do psicólogo, novo responsável e consentimento eram só
--    'in_app': o aluno só sabia ao abrir o app. A cópia em push leva o
--    MESMO texto genérico ("Você tem uma mensagem nova"), nunca o
--    conteúdo, porque aparece na tela bloqueada.
-- ---------------------------------------------------------------------
create or replace function public.espelhar_em_push()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.canal = 'in_app' and new.tipo in ('mensagem_apoio', 'vinculo', 'consentimento', 'consulta') then
    insert into public.notificacoes (user_id, canal, tipo, titulo, corpo, payload)
    values (new.user_id, 'push', new.tipo, new.titulo, new.corpo, new.payload);
  end if;
  return new;
end $$;

drop trigger if exists notificacoes_espelhar_push on public.notificacoes;
create trigger notificacoes_espelhar_push
  after insert on public.notificacoes
  for each row execute function public.espelhar_em_push();

-- ---------------------------------------------------------------------
-- 5. Lembretes do dia (só o servidor chama)
-- ---------------------------------------------------------------------
create or replace function public.lembretes_do_dia(p_tipo text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n    integer := 0;
begin
  if p_tipo = 'revisao' then
    -- Um lembrete por aluno, com a contagem, e não um por tópico.
    insert into public.notificacoes (user_id, canal, tipo, titulo, corpo, payload)
    select r.user_id, 'push', 'revisao',
           'Hora de revisar',
           case when count(*) = 1 then 'Uma revisão vence hoje: ' || min(r.topico_nome) || '.'
                else count(*) || ' revisões vencem hoje. Dez minutos já seguram a matéria.' end,
           jsonb_build_object('url', '/?aba=calendario')
      from public.revisoes_espacadas r
     where r.proxima_revisao <= v_hoje
       and exists (select 1 from public.push_inscricoes i where i.user_id = r.user_id)
       and not exists (
         select 1 from public.notificacoes n
          where n.user_id = r.user_id and n.tipo = 'revisao' and n.canal = 'push'
            and n.criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))
     group by r.user_id;
    get diagnostics v_n = row_count;

  elsif p_tipo = 'ofensiva' then
    -- Estudou ontem e ainda não hoje, com pelo menos 2 noites seguidas:
    -- é aí que um lembrete à noite salva a sequência.
    insert into public.notificacoes (user_id, canal, tipo, titulo, corpo, payload)
    select g.user_id, 'push', 'ofensiva',
           'Sua ofensiva está esperando',
           g.streak || ' noites seguidas. Uma questão hoje já mantém a lua acesa.',
           jsonb_build_object('url', '/?aba=quiz')
      from public.gamificacao g
     where g.streak >= 2
       and g.ultimo_acesso = v_hoje - 1
       and exists (select 1 from public.push_inscricoes i where i.user_id = g.user_id)
       and not exists (
         select 1 from public.notificacoes n
          where n.user_id = g.user_id and n.tipo = 'ofensiva' and n.canal = 'push'
            and n.criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'));
    get diagnostics v_n = row_count;
  else
    raise exception 'tipo de lembrete desconhecido: %', p_tipo;
  end if;

  return v_n;
end $$;

revoke all on function public.lembretes_do_dia(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. O que pode sair agora
-- ---------------------------------------------------------------------
create or replace function public.pushes_para_enviar(p_limite integer default 100)
returns table (id uuid, user_id uuid, tipo text, titulo text, corpo text, payload jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_hora   integer := extract(hour from now() at time zone 'America/Sao_Paulo')::integer;
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  r        record;
  v_chave  text;
  v_pref   public.preferencias_notificacao;
  v_ja     integer;
  v_silen  boolean;
  -- Quantos já saíram NESTA rodada, por usuário: a coluna `enviada_em`
  -- só é marcada pelo worker depois da entrega, então sem este contador
  -- uma fila de 5 passava inteira por um limite de 2.
  v_nesta  jsonb := '{}';
begin
  for r in
    select n.* from public.notificacoes n
     where n.canal = 'push' and n.enviada_em is null and n.descartada is null and n.tentativas < 3
     order by n.criado_em
     limit greatest(1, least(coalesce(p_limite, 100), 500))
     for update skip locked
  loop
    v_chave := public.chave_preferencia_notificacao(r.tipo);
    select * into v_pref from public.preferencias_notificacao p where p.user_id = r.user_id;

    -- Sem aparelho inscrito não há para onde mandar.
    if not exists (select 1 from public.push_inscricoes i where i.user_id = r.user_id) then
      update public.notificacoes set descartada = 'sem aparelho' where notificacoes.id = r.id;
      continue;
    end if;

    if coalesce((v_pref.tipos ->> v_chave)::boolean, true) = false then
      update public.notificacoes set descartada = 'desativada' where notificacoes.id = r.id;
      continue;
    end if;

    if v_chave <> 'alerta' and r.criado_em < now() - interval '24 hours' then
      update public.notificacoes set descartada = 'expirada' where notificacoes.id = r.id;
      continue;
    end if;

    v_silen := case
      when coalesce(v_pref.silencio_inicio, 22) = coalesce(v_pref.silencio_fim, 7) then false
      when coalesce(v_pref.silencio_inicio, 22) > coalesce(v_pref.silencio_fim, 7)
        then v_hora >= coalesce(v_pref.silencio_inicio, 22) or v_hora < coalesce(v_pref.silencio_fim, 7)
      else v_hora >= coalesce(v_pref.silencio_inicio, 22) and v_hora < coalesce(v_pref.silencio_fim, 7)
    end;
    if v_silen then
      continue;  -- espera o silêncio acabar
    end if;

    if v_chave <> 'alerta' then
      select count(*) into v_ja from public.notificacoes n2
       where n2.user_id = r.user_id and n2.canal = 'push' and n2.enviada_em >= v_inicio
         and public.chave_preferencia_notificacao(n2.tipo) <> 'alerta';
      v_ja := v_ja + coalesce((v_nesta ->> r.user_id::text)::integer, 0);
      if v_ja >= coalesce(v_pref.limite_diario, 3) then
        update public.notificacoes set descartada = 'limite diario' where notificacoes.id = r.id;
        continue;
      end if;
      v_nesta := v_nesta || jsonb_build_object(r.user_id::text, coalesce((v_nesta ->> r.user_id::text)::integer, 0) + 1);
    end if;

    id := r.id; user_id := r.user_id; tipo := r.tipo; titulo := r.titulo; corpo := r.corpo; payload := r.payload;
    return next;
  end loop;
end $$;

revoke all on function public.pushes_para_enviar(integer) from public, anon, authenticated;

commit;

-- =====================================================================
-- Verificação
--   select public.lembretes_do_dia('revisao');
--   select * from public.pushes_para_enviar(10);
--   select descartada, count(*) from public.notificacoes where canal = 'push' group by 1;
-- =====================================================================
