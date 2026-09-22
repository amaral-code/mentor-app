-- =====================================================================
-- TERMOMETRO COGNITIVO — mapa de calor anonimo por turma (docente)
--
-- O QUE RESOLVE
--   O painel do professor mostrava o que a turma ERRA (020). Faltava o
--   que a turma SENTE: quantos alunos estao em fadiga/esgotamento hoje,
--   com que sinal (madrugada, distracao, foco curto) — para a escola
--   decidir a aula, nao para vigiar aluno.
--
-- DE ONDE VEM O DADO (nada novo e coletado)
--   indice_burnout   (010/011) score + classe por aluno/dia
--   focus_metrics    (019)     minutos focados e perdas de foco
--   telemetria_estudo(010)     hora local das respostas -> madrugada
--
-- PRIVACIDADE
--   - Retorna SOMENTE agregados por turma: nenhum user_id, nenhum nome,
--     nenhum texto de aluno.
--   - Turma com menos de 5 alunos medidos e DESCARTADA no proprio SQL.
--     Com 2 ou 3 alunos, "67% em exaustao" aponta para uma pessoa. O
--     front repete o corte (termometroCognitivo.ts), mas quem manda e
--     este arquivo: dado que nao sai do banco nao vaza em log nenhum.
--   - Escopo = escola do solicitante; so docente/educador/admin executa.
--
-- Idempotente. Rode depois da 021.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Predicado de acesso
-- ---------------------------------------------------------------------
-- `sou_educador()` (003) cobre educator/admin — a secretaria. O
-- termometro e do PROFESSOR, papel 'teacher' criado na 018, que nao
-- entra naquele predicado. Funcao propria em vez de alterar a antiga:
-- sou_educador() tambem libera importacao de turma e regeneracao de
-- codigo, e docente nao pode nada disso.
create or replace function public.sou_docente()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel::text in ('teacher','educator','admin')
       from public.perfis where id = (select auth.uid())),
    false);
$$;

comment on function public.sou_docente() is
  'Verdadeiro para teacher/educator/admin: leitura de agregados pedagogicos.';

-- ---------------------------------------------------------------------
-- Agregacao
-- ---------------------------------------------------------------------
create or replace function public.termometro_cognitivo(p_dias integer default 1)
returns table (
  turma_id uuid,
  turma_nome text,
  total_alunos integer,
  com_indice integer,
  exaustos integer,
  em_alerta integer,
  score_medio numeric,
  minutos_foco_medio numeric,
  distracoes_media numeric,
  fracao_madrugada numeric
)
language plpgsql security definer set search_path = public as $$
declare
  v_escola uuid;
  -- Teto de 30 dias: janela maior vira historico, e historico de saude
  -- mental por turma nao e material de painel de aula.
  v_dias integer := greatest(1, least(coalesce(p_dias, 1), 30));
  v_minimo constant integer := 5; -- piso de anonimato (k-anonymity)
begin
  if not public.sou_docente() then
    raise exception 'sem_permissao: so docente/educador le o termometro cognitivo';
  end if;

  v_escola := public.minha_escola_id();
  if v_escola is null then
    raise exception 'sem_escola: conta sem escola vinculada';
  end if;

  return query
  with alunos as (
    select p.id, p.turma_id
    from public.perfis p
    where p.escola_id = v_escola
      and p.papel::text = 'student'
      and p.turma_id is not null
  ),
  -- Uma linha por aluno: o indice MAIS RECENTE da janela. Somar todos os
  -- dias contaria o mesmo aluno varias vezes e inflaria a porcentagem.
  indice as (
    select distinct on (b.user_id)
           b.user_id, a.turma_id, b.score, b.classe
    from public.indice_burnout b
    join alunos a on a.id = b.user_id
    where b.data >= (now() at time zone 'America/Sao_Paulo')::date - (v_dias - 1)
    order by b.user_id, b.data desc
  ),
  foco as (
    select a.turma_id,
           avg(f.focused_minutes)::numeric   as minutos,
           avg(f.distraction_count)::numeric as distracoes
    from public.focus_metrics f
    join alunos a on a.id = f.user_id
    where f.session_date >= (now() at time zone 'America/Sao_Paulo')::date - (v_dias - 1)
    group by a.turma_id
  ),
  madrugada as (
    select a.turma_id,
           (count(*) filter (where t.hora_local between 0 and 5))::numeric
             / nullif(count(*), 0)::numeric as fracao
    from public.telemetria_estudo t
    join alunos a on a.id = t.user_id
    where t.criado_em >= now() - (v_dias || ' days')::interval
    group by a.turma_id
  )
  select
    tm.id,
    tm.nome,
    (select count(*) from alunos a where a.turma_id = tm.id)::integer,
    count(i.user_id)::integer,
    count(*) filter (where i.classe in ('fadiga','esgotamento'))::integer,
    count(*) filter (where i.classe = 'alerta')::integer,
    round(coalesce(avg(i.score), 0), 1),
    round(coalesce(max(f.minutos), 0), 1),
    round(coalesce(max(f.distracoes), 0), 1),
    round(coalesce(max(m.fracao), 0), 3)
  from public.turmas tm
  join indice i on i.turma_id = tm.id
  left join foco f on f.turma_id = tm.id
  left join madrugada m on m.turma_id = tm.id
  where tm.escola_id = v_escola
  group by tm.id, tm.nome
  having count(i.user_id) >= v_minimo
  order by
    (count(*) filter (where i.classe in ('fadiga','esgotamento')))::numeric
      / nullif(count(i.user_id), 0) desc nulls last,
    tm.nome;
end $$;

comment on function public.termometro_cognitivo(integer) is
  'Mapa de calor anonimo por turma (burnout + foco + madrugada). Minimo de 5 alunos medidos por turma.';

revoke all on function public.termometro_cognitivo(integer) from public, anon;
grant execute on function public.termometro_cognitivo(integer) to authenticated;

commit;

-- =====================================================================
-- Verificacao (logado como docente da escola):
--   select * from public.termometro_cognitivo(1);
--   select * from public.termometro_cognitivo(7);
-- Aluno deve receber: sem_permissao.
-- =====================================================================
