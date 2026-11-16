-- =====================================================================
-- 030 — Teto diário de moedas do foco: o dia é o de Brasília, de verdade
-- =====================================================================
--
-- O DEFEITO
-- ---------------------------------------------------------------------
-- `creditar_moedas_foco` (011) somava as moedas "de hoje" assim:
--
--   where s.inicio >= (now() at time zone 'America/Sao_Paulo')::date::timestamptz
--
-- Dois erros na mesma linha:
--
--   1. `::date::timestamptz` converte a data de volta no fuso da SESSÃO
--      do banco, que no Supabase é UTC. O "dia" começava à meia-noite
--      UTC, ou seja, às 21h de Brasília.
--   2. A soma olhava o INÍCIO da sessão. As moedas são pagas quando a
--      sessão termina: uma sessão de 4h que começou ontem e terminou hoje
--      ficava fora do total de hoje. Somando as duas coisas, quem
--      estudava à noite passava do teto de 500 moedas por dia.
--
-- O teste "respeita o teto diario" falhava justamente entre ~21h e ~1h.
--
-- A CORREÇÃO
-- ---------------------------------------------------------------------
-- O total do dia soma pelo `criado_em`: a hora em que o SERVIDOR pagou,
-- que o aparelho não consegue adiantar nem atrasar. E o começo do dia é
-- a meia-noite de Brasília convertida de volta com o mesmo fuso:
--
--   date_trunc('day', now() at time zone 'America/Sao_Paulo')
--     at time zone 'America/Sao_Paulo'
--
-- O resto da função é o da 011, linha a linha. Novo índice para a soma
-- não varrer o histórico inteiro do aluno.
-- =====================================================================

begin;

create index if not exists offline_user_criado_idx
  on public.sessoes_offline (user_id, criado_em desc);

create or replace function public.creditar_moedas_foco(
  p_inicio       timestamptz,
  p_fim          timestamptz,
  p_interrupcoes integer default 0,
  p_modo         text default 'enem'
)
returns table (saldo integer, moedas_creditadas integer, minutos integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user      uuid := (select auth.uid());
  v_min       integer;
  v_int       integer := greatest(0, least(coalesce(p_interrupcoes, 0), 50));
  v_modo      text := case when p_modo in ('enem','leve','maratona') then p_modo else 'enem' end;
  v_mult_modo numeric;
  v_mult_faixa numeric;
  v_moedas    integer;
  v_hoje_total integer;
  v_saldo     integer;
  TETO_DIARIO constant integer := 500;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_fim <= p_inicio then raise exception 'intervalo invalido'; end if;
  if p_fim > now() + interval '2 minutes' then raise exception 'sessao no futuro'; end if;
  if p_inicio < now() - interval '24 hours' then raise exception 'sessao antiga demais'; end if;

  -- Minutos reais, com teto de 4h por sessao.
  v_min := least(240, floor(extract(epoch from (p_fim - p_inicio)) / 60)::int);

  -- Espelha TIERS em packages/core/src/focusShield.ts
  v_mult_faixa := case
    when v_min < 5  then 0
    when v_min < 15 then 0.5
    when v_min < 25 then 1.0
    when v_min < 50 then 1.25
    when v_min < 90 then 1.5
    else 1.75 end;

  v_mult_modo := case v_modo when 'leve' then 0.8 when 'maratona' then 1.2 else 1.0 end;

  v_moedas := floor(
    v_min * v_mult_faixa * v_mult_modo * greatest(0.4, 1 - 0.1 * v_int)
  )::int;

  -- Teto diario: o resto da sessao ainda e registrado, mas nao paga.
  -- Soma pelo momento do pagamento (criado_em), a partir da meia-noite
  -- de Brasilia. Ver o cabecalho desta migration.
  select coalesce(sum(s.moedas_creditadas), 0) into v_hoje_total
    from public.sessoes_offline s
   where s.user_id = v_user
     and s.criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
                          at time zone 'America/Sao_Paulo';

  v_moedas := greatest(0, least(v_moedas, TETO_DIARIO - v_hoje_total));

  insert into public.sessoes_offline (user_id, inicio, fim, minutos_offline, interrupcoes, modo, moedas_creditadas)
  values (v_user, p_inicio, p_fim, v_min, v_int, v_modo, v_moedas);

  insert into public.carteira_foco (user_id) values (v_user) on conflict (user_id) do nothing;

  update public.carteira_foco c
     set saldo = c.saldo + v_moedas,
         total_ganho = c.total_ganho + v_moedas,
         atualizado_em = now()
   where c.user_id = v_user
   returning c.saldo into v_saldo;

  if v_moedas > 0 then
    insert into public.extrato_foco (user_id, delta, motivo)
    values (v_user, v_moedas, format('%s min offline (%s)', v_min, v_modo));
  end if;

  return query select v_saldo, v_moedas, v_min;
end $$;

commit;
