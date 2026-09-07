-- Ampli-IA - REINICIAR INDICE DE FADIGA
--
-- Zera a base do modelo para o proprio aluno: apaga a telemetria e a
-- serie do indice. O modelo recomeça do zero e volta a calcular a partir
-- das proximas respostas (o card fica oculto ate 5 eventos, como manda a
-- regra de amostra minima).
--
-- Por que RPC e nao DELETE direto: indice_burnout so tem policy de SELECT
-- (escrita exclusiva via registrar_burnout), entao o aluno nao conseguiria
-- apagar a propria serie pela tabela. A RPC roda como dono e filtra pelo
-- auth.uid(), entao ninguem zera o dado de ninguem.
-- =====================================================================

create or replace function public.reiniciar_indice()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  delete from public.telemetria_estudo where user_id = v_user;
  delete from public.indice_burnout   where user_id = v_user;
end $$;

-- =====================================================================
-- Verificacao:
--   select public.reiniciar_indice();
--   select count(*) from telemetria_estudo;  -- 0 para quem chamou
--   select count(*) from indice_burnout;     -- 0 para quem chamou
-- =====================================================================
