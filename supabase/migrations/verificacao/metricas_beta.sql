-- =====================================================================
-- Métricas do beta fechado (issue #74). Rodar no SQL Editor.
-- =====================================================================
-- Troque a lista de escolas no primeiro `with` pelas escolas do beta
-- (vazia = todas). Nada aqui é exposto ao app: é leitura da equipe.
--
-- Atividade = qualquer registro de estudo (log de XP, questão
-- respondida, quiz concluído, sessão de foco), contada por dia de
-- Brasília. Conta de demonstração fica de fora.
--
--   retenção D1 / D7: dos alunos que entraram na coorte, quantos
--                     estudaram exatamente 1 / 7 dias depois do cadastro
--   sessões por semana: média de dias ativos por aluno ativo na semana
--   NPS: % de notas 9 e 10 menos % de notas 0 a 6 (feedback_beta)
-- =====================================================================

with escolas_beta(id) as (
  select null::uuid where false   -- ex.: values ('uuid-1'::uuid), ('uuid-2'::uuid)
),
alunos as (
  select p.id, (p.criado_em at time zone 'America/Sao_Paulo')::date as dia_cadastro
    from public.perfis p
   where p.papel::text = 'student'
     and not exists (select 1 from public.contas_demo d where d.user_id = p.id)
     and (not exists (select 1 from escolas_beta) or p.escola_id in (select id from escolas_beta))
),
atividade as (
  select distinct a.user_id, (a.criado_em at time zone 'America/Sao_Paulo')::date as dia
    from (
      select user_id, criado_em from public.logs
      union all select user_id, criado_em from public.telemetria_estudo
      union all select user_id, criado_em from public.quiz_resultados
      union all select user_id, criado_em from public.sessoes_foco
    ) a
   where a.user_id in (select id from alunos)
),
retencao as (
  select count(*) filter (where al.dia_cadastro <= current_date - 1) as coorte_d1,
         count(*) filter (where al.dia_cadastro <= current_date - 1
                            and exists (select 1 from atividade x where x.user_id = al.id and x.dia = al.dia_cadastro + 1)) as voltou_d1,
         count(*) filter (where al.dia_cadastro <= current_date - 7) as coorte_d7,
         count(*) filter (where al.dia_cadastro <= current_date - 7
                            and exists (select 1 from atividade x where x.user_id = al.id and x.dia = al.dia_cadastro + 7)) as voltou_d7
    from alunos al
),
semana as (
  select count(distinct user_id) as ativos_7d,
         round(count(*)::numeric / nullif(count(distinct user_id), 0), 1) as dias_ativos_por_aluno
    from atividade
   where dia > current_date - 7
),
nps as (
  select count(*) as respostas,
         round(100.0 * (count(*) filter (where f.nota >= 9) - count(*) filter (where f.nota <= 6)) / nullif(count(*), 0)) as nps
    from public.feedback_beta f
   where f.nota is not null
     and f.user_id in (select id from alunos)
)
select (select count(*) from alunos)                                         as alunos,
       r.coorte_d1, round(100.0 * r.voltou_d1 / nullif(r.coorte_d1, 0), 1) as retencao_d1_pct,
       r.coorte_d7, round(100.0 * r.voltou_d7 / nullif(r.coorte_d7, 0), 1) as retencao_d7_pct,
       s.ativos_7d, s.dias_ativos_por_aluno,
       n.respostas as respostas_nps, n.nps
  from retencao r, semana s, nps n;

-- Feedback mais recente, para a rodada quinzenal de correções:
--   select tipo, nota, tela, texto, criado_em from public.feedback_beta order by criado_em desc limit 100;
