-- =====================================================================
-- 031 — Sessão de foco no relógio do SERVIDOR (anti-fraude de moedas)
-- =====================================================================
--
-- O DEFEITO
-- ---------------------------------------------------------------------
-- `creditar_moedas_foco` (011) recebia do aparelho o INÍCIO e o FIM da
-- sessão. O servidor só conferia se o fim não estava no futuro e se o
-- início não passava de 24 horas. Nada provava que a sessão existiu:
--
--   select creditar_moedas_foco(now() - interval '4 hours', now(), 0, 'maratona');
--
-- no console do navegador pagava 4 horas de foco que nunca aconteceram,
-- e mudar a hora do celular antes de encerrar fazia o mesmo pelo app.
-- O teto diário (500) limitava o estrago, mas o estrago era o teto
-- inteiro, todo dia, sem estudar nada.
--
-- A CORREÇÃO
-- ---------------------------------------------------------------------
-- O servidor carimba o começo e o fim com o PRÓPRIO relógio:
--
--   iniciar_sessao_foco(modo)        -> abre a sessão (now() do banco)
--   encerrar_sessao_foco(id, min, n) -> fecha (now() do banco) e paga
--
-- O aparelho só informa quantos minutos a tela ficou apagada (medidos
-- pelo módulo nativo com relógio monotônico) e quantas vezes o aluno
-- voltou. O pagamento usa o MENOR entre o que o aparelho mediu e o que o
-- servidor viu passar entre abrir e fechar. Mudar a hora do aparelho
-- não muda nenhum dos dois números.
--
-- A fórmula e o teto diário continuam os de `creditar_moedas_foco`
-- (011, ou 030 quando aplicada): `encerrar` chama a função antiga com
-- início e fim calculados AQUI. E a porta antiga deixa de aceitar
-- chamada direta do cliente: sem isso, a fraude continuava a um RPC.
--
-- ORDEM DE IMPLANTAÇÃO
-- ---------------------------------------------------------------------
-- Publique o app (web e celular) ANTES de rodar esta migration. O app
-- novo usa as funções novas quando existem e cai na antiga quando não
-- existem; o app velho (aba aberta, PWA em cache) só sabe a antiga, e
-- depois desta migration recebe "permissão negada" ao creditar.
-- =====================================================================

begin;

create table if not exists public.sessoes_foco_abertas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  modo         text not null default 'enem' check (modo in ('enem', 'leve', 'maratona')),
  iniciada_em  timestamptz not null default now(),
  encerrada_em timestamptz
);

-- Uma sessão aberta por aluno: duas em paralelo pagariam o mesmo tempo duas vezes.
create unique index if not exists sessoes_foco_uma_aberta
  on public.sessoes_foco_abertas (user_id) where encerrada_em is null;

alter table public.sessoes_foco_abertas enable row level security;

-- Só leitura da própria (o app retoma a sessão depois de reiniciar).
-- Nenhuma policy de escrita: abrir e fechar é só pelas funções abaixo.
drop policy if exists "dono le sessao de foco" on public.sessoes_foco_abertas;
create policy "dono le sessao de foco" on public.sessoes_foco_abertas
  for select using (user_id = (select auth.uid()));

create or replace function public.iniciar_sessao_foco(p_modo text default 'enem')
returns table (sessao_id uuid, iniciada_em timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
  v_modo text := case when p_modo in ('enem', 'leve', 'maratona') then p_modo else 'enem' end;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;

  -- Sessão esquecida aberta fecha SEM pagar: abrir outra não pode
  -- transformar o tempo das duas em moeda.
  update public.sessoes_foco_abertas s
     set encerrada_em = now()
   where s.user_id = v_user and s.encerrada_em is null;

  return query
    insert into public.sessoes_foco_abertas as s (user_id, modo)
    values (v_user, v_modo)
    returning s.id, s.iniciada_em;
end $$;

create or replace function public.encerrar_sessao_foco(
  p_sessao           uuid,
  p_minutos_offline  numeric,
  p_interrupcoes     integer default 0
)
returns table (saldo integer, moedas_creditadas integer, minutos integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user       uuid := (select auth.uid());
  v_modo       text;
  v_iniciada   timestamptz;
  v_decorridos numeric;
  v_min        numeric;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;

  -- Fecha e lê numa operação só: duas chamadas simultâneas com o mesmo
  -- id não conseguem pagar duas vezes (a segunda não acha sessão aberta).
  update public.sessoes_foco_abertas s
     set encerrada_em = now()
   where s.id = p_sessao and s.user_id = v_user and s.encerrada_em is null
  returning s.modo, s.iniciada_em into v_modo, v_iniciada;

  if v_iniciada is null then raise exception 'sessao inexistente ou ja encerrada'; end if;

  v_decorridos := extract(epoch from (now() - v_iniciada)) / 60;
  v_min := greatest(0, least(coalesce(p_minutos_offline, 0), v_decorridos));

  if v_min < 1 then
    return query
      select coalesce((select c.saldo from public.carteira_foco c where c.user_id = v_user), 0), 0, 0;
    return;
  end if;

  return query
    select * from public.creditar_moedas_foco(
      now() - make_interval(secs => (v_min * 60)::double precision),
      now(),
      p_interrupcoes,
      v_modo
    );
end $$;

revoke all on function public.iniciar_sessao_foco(text) from public, anon;
grant execute on function public.iniciar_sessao_foco(text) to authenticated;
revoke all on function public.encerrar_sessao_foco(uuid, numeric, integer) from public, anon;
grant execute on function public.encerrar_sessao_foco(uuid, numeric, integer) to authenticated;

-- A porta antiga: o cliente dizia início e fim. Continua existindo (é
-- ela que `encerrar_sessao_foco` chama, com o dono da função), mas sem
-- execução para quem está logado.
revoke execute on function public.creditar_moedas_foco(timestamptz, timestamptz, integer, text)
  from public, anon, authenticated;

commit;
