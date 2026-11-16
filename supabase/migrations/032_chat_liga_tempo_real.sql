-- =====================================================================
-- 032 — Chat da liga em tempo real, moderação no servidor e denúncia
-- =====================================================================
--
-- O QUE ESTAVA ERRADO
-- ---------------------------------------------------------------------
-- 1. As mensagens da liga moravam DENTRO de `ligas.dados` (jsonb). Para
--    mandar uma, o app lia a liga inteira, acrescentava a mensagem e
--    regravava tudo. Duas pessoas escrevendo no mesmo segundo: a segunda
--    gravação apagava a primeira. E não havia como avisar os outros
--    membros a não ser recarregando a liga inteira.
-- 2. Liga privada "só aparece para quem tem o código" (006), mas nenhuma
--    função recebia o código: a policy só mostra a liga a quem já é
--    membro, então ninguém conseguia entrar numa liga privada.
-- 3. A moderação era só no aparelho. Um RPC direto publicava qualquer
--    coisa no mural da turma.
--
-- O QUE MUDA
-- ---------------------------------------------------------------------
-- * `mensagens_liga`: uma linha por mensagem, lida e escrita só por
--   membros, publicada no Supabase Realtime (chega aos outros em menos
--   de 1 s). `mensagens_comunidade` também entra na publicação.
-- * `entrar_na_liga_por_codigo(codigo)`.
-- * `texto_ofensivo(texto)`: lista curta e grossa, por palavra inteira,
--   barrando o insert nos dois chats. O app modera ANTES (lista maior,
--   em @mentor/core/moderationEngine); esta é a tranca de quem pula o app.
-- * `denuncias_mensagem`: qualquer membro denuncia; com 3 denúncias de
--   pessoas diferentes a mensagem some para os outros até alguém da
--   escola revisar (a revisão é do painel da secretaria, M6).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Moderação no servidor
-- ---------------------------------------------------------------------
create or replace function public.texto_ofensivo(p_texto text)
returns boolean
language sql immutable as $$
  select (' ' || regexp_replace(
            lower(translate(coalesce(p_texto, ''),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
              'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
            '[^a-z0-9]+', ' ', 'g') || ' ')
    ~ ' (caralho|porra|merda|foda|fodase|buceta|puta|putaria|arrombad[oa]|vsf|vsfd|pqp|fdp|viado|vagabund[oa]|cusao|boquete|tnc|vai tomar no cu|pau no cu|filho da puta|puta que pariu|vai se fuder) '
$$;

create or replace function public.barra_texto_ofensivo()
returns trigger
language plpgsql as $$
begin
  if public.texto_ofensivo(new.conteudo) then
    raise exception 'mensagem bloqueada pela moderacao';
  end if;
  return new;
end $$;

drop trigger if exists mensagens_comunidade_moderacao on public.mensagens_comunidade;
create trigger mensagens_comunidade_moderacao
  before insert on public.mensagens_comunidade
  for each row execute function public.barra_texto_ofensivo();

-- ---------------------------------------------------------------------
-- Mensagens da liga
-- ---------------------------------------------------------------------
create table if not exists public.mensagens_liga (
  id        bigint generated always as identity primary key,
  liga_id   uuid not null references public.ligas (id) on delete cascade,
  autor_id  uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  conteudo  text not null check (char_length(btrim(conteudo)) between 1 and 500),
  oculta    boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists mensagens_liga_idx on public.mensagens_liga (liga_id, criado_em desc);

alter table public.mensagens_liga enable row level security;

-- Membro (ou quem criou) lê; mensagem oculta por denúncia só o autor vê.
drop policy if exists mensagens_liga_sel on public.mensagens_liga;
create policy mensagens_liga_sel on public.mensagens_liga for select using (
  (public.sou_membro_liga(liga_id) or public.sou_criador_liga(liga_id))
  and (not oculta or autor_id = (select auth.uid()))
);

drop policy if exists mensagens_liga_ins on public.mensagens_liga;
create policy mensagens_liga_ins on public.mensagens_liga for insert with check (
  autor_id = (select auth.uid())
  and (public.sou_membro_liga(liga_id) or public.sou_criador_liga(liga_id))
);

drop policy if exists mensagens_liga_del on public.mensagens_liga;
create policy mensagens_liga_del on public.mensagens_liga for delete using (autor_id = (select auth.uid()));
-- Sem policy de update: mensagem publicada não muda de texto.

drop trigger if exists mensagens_liga_moderacao on public.mensagens_liga;
create trigger mensagens_liga_moderacao
  before insert on public.mensagens_liga
  for each row execute function public.barra_texto_ofensivo();

-- ---------------------------------------------------------------------
-- Entrada por código
-- ---------------------------------------------------------------------
create or replace function public.entrar_na_liga_por_codigo(p_codigo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
  v_liga uuid;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select l.id into v_liga from public.ligas l where upper(l.codigo) = upper(btrim(p_codigo));
  if v_liga is null then raise exception 'codigo invalido'; end if;
  insert into public.liga_membros (liga_id, user_id) values (v_liga, v_user)
  on conflict do nothing;
  return v_liga;
end $$;

revoke all on function public.entrar_na_liga_por_codigo(text) from public, anon;
grant execute on function public.entrar_na_liga_por_codigo(text) to authenticated;

-- ---------------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------------
create table if not exists public.denuncias_mensagem (
  id             bigint generated always as identity primary key,
  origem         text not null check (origem in ('liga', 'turma')),
  mensagem_id    bigint not null,
  denunciante_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  motivo         text not null default 'ofensiva' check (motivo in ('ofensiva', 'bullying', 'spam', 'outro')),
  criado_em      timestamptz not null default now(),
  unique (origem, mensagem_id, denunciante_id)
);

alter table public.denuncias_mensagem enable row level security;

-- Cada um vê as próprias denúncias. Quem foi denunciado não sabe por quem.
drop policy if exists denuncias_sel on public.denuncias_mensagem;
create policy denuncias_sel on public.denuncias_mensagem for select using (denunciante_id = (select auth.uid()));

/* Só denuncia o que consegue ver: a checagem roda com a RLS de quem
   denuncia, então mensagem de liga alheia não é alcançável. */
create or replace function public.pode_ver_mensagem(p_origem text, p_mensagem bigint)
returns boolean
language sql stable security invoker set search_path = public as $$
  select case p_origem
    when 'liga' then exists (select 1 from public.mensagens_liga m where m.id = p_mensagem)
    when 'turma' then exists (select 1 from public.mensagens_comunidade m where m.id = p_mensagem)
    else false end
$$;

drop policy if exists denuncias_ins on public.denuncias_mensagem;
create policy denuncias_ins on public.denuncias_mensagem for insert with check (
  denunciante_id = (select auth.uid()) and public.pode_ver_mensagem(origem, mensagem_id)
);

/* Três pessoas diferentes denunciaram: some para os outros. Um só
   denunciante não derruba mensagem de ninguém (seria arma de briga). */
create or replace function public.oculta_mensagem_denunciada()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_total integer;
begin
  select count(*) into v_total from public.denuncias_mensagem d
   where d.origem = new.origem and d.mensagem_id = new.mensagem_id;
  if v_total >= 3 then
    if new.origem = 'liga' then
      update public.mensagens_liga set oculta = true where id = new.mensagem_id;
    else
      update public.mensagens_comunidade set moderada = false, motivo_mod = 'denunciada' where id = new.mensagem_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists denuncias_oculta on public.denuncias_mensagem;
create trigger denuncias_oculta
  after insert on public.denuncias_mensagem
  for each row execute function public.oculta_mensagem_denunciada();

-- ---------------------------------------------------------------------
-- Realtime (só existe no Supabase; o teste local não tem a publicação)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.mensagens_liga;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.mensagens_comunidade;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
