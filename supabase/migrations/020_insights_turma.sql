-- =====================================================================
-- Mentor Noturno (HackTudo 2026) - EPICO 3: Insights da turma (lote)
--
-- MAPEAMENTO DO SPEC PARA O SCHEMA REAL:
--   Spec pede:  chat_logs (id, topic, is_error, timestamp) das ultimas 24h.
--   Repo tem:   quiz_desempenho_topicos (placar por conta/materia/topico,
--               migration 015) + quiz_questoes_exibidas (volume de questoes,
--               migration 014) + perfis (escola_id, papel).
--   Por isso a agregacao le dessas duas tabelas em vez de criar uma
--   chat_logs paralela: evita dupla escrita e reaproveita o placar que o
--   app ja incrementa via registrar_desempenho_topico().
--
-- PRIVACIDADE (fim da sobrecarga SEM expor chats individuais):
--   - Retorna SOMENTE agregados por (materia, topico): nenhum texto de
--     aluno, nenhum user_id, nenhum chat_mensagens.
--   - Escopo = escola do solicitante (minha_escola_id()); so
--     educator/admin (sou_educador()) executa - aluno recebe excecao.
--
-- Idempotente. Rode depois da 019.
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
  v_escola uuid;
  v_horas integer := greatest(1, least(coalesce(p_horas, 24), 168));
  v_total_alunos integer := 0;
begin
  if not public.sou_educador() then
    raise exception 'sem_permissao: so educator/admin le insights da turma';
  end if;

  v_escola := public.minha_escola_id();
  if v_escola is null then
    raise exception 'sem_escola: conta sem escola vinculada';
  end if;

  select count(*)::integer into v_total_alunos
  from public.perfis p
  where p.escola_id = v_escola
    and p.papel::text = 'student';

  return query
  with janela as (
    select d.materia, d.topico, d.user_id, d.acertos, d.erros
    from public.quiz_desempenho_topicos d
    join public.perfis p on p.id = d.user_id
    where p.escola_id = v_escola
      and p.papel::text = 'student'
      and d.atualizado_em >= now() - (v_horas || ' hours')::interval
  ),
  volume as (
    select q.materia, coalesce(q.topico, '') as topico, count(*)::bigint as perguntas
    from public.quiz_questoes_exibidas q
    join public.perfis p on p.id = q.user_id
    where p.escola_id = v_escola
      and p.papel::text = 'student'
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
  'EPICO 3: topicos com mais erro na escola nas ultimas N horas (agregado, sem expor chats).';

revoke all on function public.insights_turma_24h(integer) from public, anon;
grant execute on function public.insights_turma_24h(integer) to authenticated;

commit;
