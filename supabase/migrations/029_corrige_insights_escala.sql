-- =====================================================================
-- 029 — Insights da turma: volta o cálculo original, com o escopo da 026
-- =====================================================================
--
-- O DEFEITO
-- ---------------------------------------------------------------------
-- A 026 reescreveu `insights_turma_24h` para o professor enxergar só as
-- turmas dele. A reescrita trocou o escopo (certo) e, sem querer, TAMBÉM
-- o cálculo, porque o corpo foi escrito de novo em vez de copiado da 020:
--
--                      020 (certo)                026 (errado)
--   taxa_dificuldade   % de erro, 0 a 100         fração de alunos, 0 a 1
--   com dificuldade    errou ao menos uma          errou mais do que acertou
--   ordem              maior taxa de erro          mais alunos
--
-- A tela espera 0 a 100. Com a 026, "5 de 7 alunos" aparecia como
-- "1% da turma": o professor lia "quase ninguém errou função afim"
-- quando foi a maioria.
--
-- A CORREÇÃO
-- ---------------------------------------------------------------------
-- O corpo abaixo é o da 020, linha a linha. A única diferença é o
-- filtro: onde a 020 dizia "alunos da escola", aqui é "alunos das
-- turmas em `minhas_turmas()`", que é o que a 026 queria mudar.
--
-- Há teste travando a escala e a regra de "com dificuldade".
-- =====================================================================

begin;

create or replace function public.insights_turma_24h(p_horas integer default 24)
returns table (
  materia text,
  topico text,
  alunos_com_dificuldade integer,
  total_alunos integer,
  taxa_dificuldade numeric,
  total_erros bigint,
  total_respostas bigint,
  perguntas_24h bigint
)
language plpgsql security definer set search_path = public as $$
declare
  v_horas integer := greatest(1, least(coalesce(p_horas, 24), 168));
  v_total_alunos integer := 0;
begin
  if not public.sou_docente() then
    raise exception 'sem_permissao: so docente/educador le insights da turma';
  end if;

  select count(*)::integer into v_total_alunos
    from public.perfis p
   where p.papel::text = 'student'
     and p.turma_id in (select mt.id from public.minhas_turmas() mt);

  return query
  with janela as (
    select d.materia, d.topico, d.user_id, d.acertos, d.erros
      from public.quiz_desempenho_topicos d
      join public.perfis p on p.id = d.user_id
     where p.papel::text = 'student'
       and p.turma_id in (select mt.id from public.minhas_turmas() mt)
       and d.atualizado_em >= now() - (v_horas || ' hours')::interval
  ),
  volume as (
    select q.materia, coalesce(q.topico, '') as topico, count(*)::bigint as perguntas
      from public.quiz_questoes_exibidas q
      join public.perfis p on p.id = q.user_id
     where p.papel::text = 'student'
       and p.turma_id in (select mt.id from public.minhas_turmas() mt)
       and q.criado_em >= now() - (v_horas || ' hours')::interval
     group by q.materia, coalesce(q.topico, '')
  )
  select
    j.materia,
    j.topico,
    count(distinct case when j.erros > 0 then j.user_id end)::integer as alunos_com_dificuldade,
    v_total_alunos as total_alunos,
    case
      when sum(j.acertos + j.erros) = 0 then 0
      else round((sum(j.erros)::numeric / sum(j.acertos + j.erros)::numeric) * 100, 1)
    end as taxa_dificuldade,
    sum(j.erros)::bigint as total_erros,
    sum(j.acertos + j.erros)::bigint as total_respostas,
    coalesce(v.perguntas, 0)::bigint as perguntas_24h
  from janela j
  left join volume v on v.materia = j.materia and v.topico = j.topico
  group by j.materia, j.topico, v.perguntas
  having sum(j.erros) > 0
  order by taxa_dificuldade desc, total_erros desc
  limit 20;
end $$;

comment on function public.insights_turma_24h(integer) is
  'Topicos com mais erro nas turmas do docente (minhas_turmas), ultimas N horas. taxa_dificuldade = % de erro, 0 a 100.';

revoke all on function public.insights_turma_24h(integer) from public, anon;
grant execute on function public.insights_turma_24h(integer) to authenticated;

commit;
