-- =====================================================================
-- 030: ofensiva no horario de Brasilia, teto diario de XP e trava da
--      data de nascimento
--
-- TRES DEFEITOS, UM ARQUIVO
--
-- 1. A OFENSIVA ZERAVA PARA QUEM ESTUDA A NOITE
--    registrar_xp() contava o dia em UTC. As 21h de Brasilia ja e "amanha"
--    em UTC, entao o aluno que estudava as 15h e de novo as 22h30 ganhava
--    dois dias de ofensiva no mesmo dia, e a tela (que conta em horario
--    local) lia a data "de amanha" e voltava a ofensiva para 1. Num app
--    de estudo noturno isso atingia justamente o horario principal.
--    O dia passa a ser o de America/Sao_Paulo, aqui e no app.
--
-- 2. XP SEM LIMITE
--    registrar_xp() aceita ate 500 XP por chamada, quantas vezes vierem.
--    Pelo console do navegador dava para chegar ao topo do ranking e
--    comprar a loja inteira em um minuto. Agora ha um teto por dia. O
--    que passa do teto e registrado no historico com 0 XP, para a
--    tentativa nao sumir.
--    O valor por evento ainda e dito pelo cliente: fechar isso de vez
--    pede calcular o XP do quiz no servidor, que e outra migration.
--
-- 3. O MENOR TROCAVA A PROPRIA DATA DE NASCIMENTO
--    A regra dos 16 anos (027) decide quem pode autorizar o psicologo, e
--    perfis.data_nascimento era editavel pelo aluno a qualquer momento:
--    bastava trocar o ano para se autorizar sozinho. A data passa a ser
--    gravada UMA vez pelo app. Corrigir depois e ato administrativo
--    (SQL Editor), como a troca de papel.
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Dia corrente do produto (fuso de Brasilia)
-- ---------------------------------------------------------------------
create or replace function public.dia_de_brasilia()
returns date
language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

grant execute on function public.dia_de_brasilia() to authenticated;

-- ---------------------------------------------------------------------
-- registrar_xp(): dia de Brasilia + teto diario
-- ---------------------------------------------------------------------
create or replace function public.registrar_xp(
  p_tipo public.log_tipo,
  p_descricao text,
  p_xp integer default 0
)
returns public.gamificacao
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := (select auth.uid());
  v_xp    integer := greatest(0, least(coalesce(p_xp, 0), 500));  -- teto por evento
  v_hoje  date := public.dia_de_brasilia();
  v_teto  constant integer := 3000;                               -- teto por dia
  v_ja    integer;
  v_row   public.gamificacao;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  -- A linha de gamificacao e travada ANTES da soma: sem isso, chamadas
  -- em paralelo leriam o mesmo total do dia e passariam juntas do teto.
  insert into public.gamificacao (user_id) values (v_user)
    on conflict (user_id) do nothing;
  perform 1 from public.gamificacao where user_id = v_user for update;

  select coalesce(sum(l.xp), 0) into v_ja
    from public.logs l
   where l.user_id = v_user
     and l.criado_em >= (v_hoje::timestamp at time zone 'America/Sao_Paulo');

  v_xp := least(v_xp, greatest(0, v_teto - v_ja));

  insert into public.logs (user_id, tipo, descricao, xp)
  values (v_user, p_tipo, left(coalesce(p_descricao, ''), 500), v_xp);

  update public.gamificacao g
     set xp     = g.xp + v_xp,
         level  = public.nivel_por_xp(g.xp + v_xp),
         streak = case
                    when g.ultimo_acesso >= v_hoje then g.streak
                    when g.ultimo_acesso = v_hoje - 1 then g.streak + 1
                    else 1
                  end,
         ultimo_acesso = greatest(coalesce(g.ultimo_acesso, v_hoje), v_hoje),
         atualizado_em = now()
   where g.user_id = v_user
   returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Data de nascimento: o app grava uma vez
-- ---------------------------------------------------------------------
create or replace function public.trava_data_nascimento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is not null
     and old.data_nascimento is not null
     and new.data_nascimento is distinct from old.data_nascimento then
    raise exception 'a data de nascimento ja foi informada e nao pode ser alterada pelo app';
  end if;
  return new;
end $$;

drop trigger if exists perfis_trava_nascimento on public.perfis;
create trigger perfis_trava_nascimento
  before update on public.perfis
  for each row execute function public.trava_data_nascimento();

commit;

-- =====================================================================
-- Verificacao
--   select public.dia_de_brasilia();          -- a data de hoje no Brasil
--   -- como um aluno com data ja preenchida, pelo app:
--   update public.perfis set data_nascimento = '2000-01-01' where id = auth.uid();
--   -- esperado: erro "a data de nascimento ja foi informada"
-- =====================================================================
