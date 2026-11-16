-- =====================================================================
-- 034 — Relatório da turma, limite por plano, cancelamento e CRP (M6)
-- =====================================================================
--
-- 1. RELATÓRIO DA TURMA (#60)
--    `resumo_turma` e `relatorio_turma`: o que o coordenador e o
--    professor precisam para decidir a próxima aula, por turma e por
--    tópico, num período escolhido. Mesmo escopo de sempre
--    (`minhas_turmas()`, migration 026): professor só as turmas dele,
--    secretaria a escola inteira.
--    PISO DE 3 ALUNOS por tópico: com 1 ou 2 alunos, "taxa de acerto do
--    tópico" é a nota de uma pessoa identificável. O professor não lê a
--    linha de nenhum aluno (RLS), e o relatório não pode virar o atalho.
--
-- 2. LIMITE DE ALUNOS POR PLANO (#63)
--    `escolas.limite_alunos` (vazio = sem limite). Um trigger em `perfis`
--    recusa o aluno que passaria do limite, venha ele da importação da
--    secretaria (service_role) ou da entrada por código.
--
-- 3. CANCELAMENTO COM REEMBOLSO DEFINIDO (#62)
--    A política fica gravada na consulta, não na cabeça de quem atende:
--      • o profissional cancelou: reembolso integral;
--      • aluno ou responsável cancelou com 24h ou mais: integral;
--      • com menos de 24h: sem reembolso.
--    Consulta não paga não tem reembolso a decidir. A devolução do
--    dinheiro em si ainda é feita no painel do Mercado Pago; a coluna diz
--    o que é devido.
--
-- 4. CRP COM FORMATO VÁLIDO (#62)
--    `registrar_psicologo` aceitava qualquer texto como CRP. Agora exige
--    "região/número" (ex.: 06/123456). Formato não é verificação: a
--    consulta ao cadastro do CFP continua manual (data em
--    `crp_verificado_em`).
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Relatório da turma
-- ---------------------------------------------------------------------
create or replace function public.resumo_turma(p_turma uuid, p_dias integer default 30)
returns table (
  turma_nome      text,
  total_alunos    integer,
  alunos_ativos   integer,
  respostas       bigint,
  taxa_acerto     numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
begin
  if not public.sou_docente() then raise exception 'sem_permissao'; end if;
  if p_turma not in (select mt.id from public.minhas_turmas() mt) then raise exception 'sem_permissao'; end if;

  return query
  with alunos as (
    select p.id from public.perfis p where p.turma_id = p_turma and p.papel::text = 'student'
  ),
  janela as (
    select d.user_id, d.acertos, d.erros from public.quiz_desempenho_topicos d
     where d.user_id in (select id from alunos)
       and d.atualizado_em >= now() - make_interval(days => v_dias)
  )
  select
    (select t.nome from public.turmas t where t.id = p_turma),
    (select count(*)::integer from alunos),
    (select count(distinct j.user_id)::integer from janela j),
    coalesce((select sum(j.acertos + j.erros) from janela j), 0)::bigint,
    case when coalesce((select sum(j.acertos + j.erros) from janela j), 0) = 0 then null
         else round((select sum(j.acertos)::numeric / sum(j.acertos + j.erros) from janela j) * 100, 1) end;
end $$;

create or replace function public.relatorio_turma(p_turma uuid, p_dias integer default 30)
returns table (
  materia                text,
  topico                 text,
  alunos_medidos         integer,
  alunos_com_dificuldade integer,
  respostas              bigint,
  taxa_acerto            numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
begin
  if not public.sou_docente() then raise exception 'sem_permissao'; end if;
  if p_turma not in (select mt.id from public.minhas_turmas() mt) then raise exception 'sem_permissao'; end if;

  return query
  select d.materia,
         d.topico,
         count(distinct d.user_id)::integer,
         count(distinct case when d.erros > d.acertos then d.user_id end)::integer,
         sum(d.acertos + d.erros)::bigint,
         round(sum(d.acertos)::numeric / nullif(sum(d.acertos + d.erros), 0) * 100, 1)
    from public.quiz_desempenho_topicos d
    join public.perfis p on p.id = d.user_id
   where p.turma_id = p_turma
     and p.papel::text = 'student'
     and d.atualizado_em >= now() - make_interval(days => v_dias)
   group by d.materia, d.topico
  having count(distinct d.user_id) >= 3
   order by 6 asc nulls last, 5 desc;
end $$;

revoke all on function public.resumo_turma(uuid, integer) from public, anon;
revoke all on function public.relatorio_turma(uuid, integer) from public, anon;
grant execute on function public.resumo_turma(uuid, integer) to authenticated;
grant execute on function public.relatorio_turma(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Limite de alunos por plano
-- ---------------------------------------------------------------------
alter table public.escolas add column if not exists limite_alunos integer check (limite_alunos is null or limite_alunos > 0);

comment on column public.escolas.limite_alunos is
  'Quantos alunos o plano da escola comporta. Vazio = sem limite. Ajustado por quem administra a plataforma.';

create or replace function public.respeita_limite_alunos()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limite integer;
  v_atual  integer;
begin
  if new.papel::text <> 'student' or new.escola_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.escola_id is not distinct from new.escola_id and old.papel = new.papel then return new; end if;

  select e.limite_alunos into v_limite from public.escolas e where e.id = new.escola_id;
  if v_limite is null then return new; end if;

  select count(*) into v_atual from public.perfis p
   where p.escola_id = new.escola_id and p.papel::text = 'student' and p.id <> new.id;
  if v_atual >= v_limite then
    raise exception 'limite de alunos do plano da escola atingido (% alunos)', v_limite;
  end if;
  return new;
end $$;

drop trigger if exists perfis_limite_alunos on public.perfis;
create trigger perfis_limite_alunos
  before insert or update of escola_id, papel on public.perfis
  for each row execute function public.respeita_limite_alunos();

-- ---------------------------------------------------------------------
-- 3. Cancelamento com reembolso definido
-- ---------------------------------------------------------------------
alter table public.agendamentos add column if not exists reembolso text check (reembolso in ('integral', 'nenhum'));
alter table public.agendamentos add column if not exists cancelado_por uuid references public.perfis(id) on delete set null;

create or replace function public.cancelar_consulta(p_id uuid, p_motivo text default null)
returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_row   public.agendamentos;
  v_quem  uuid := (select auth.uid());
  v_reemb text;
  v_outro uuid;
begin
  select * into v_row from public.agendamentos a
   where a.id = p_id
     and (a.aluno_id = v_quem or a.responsavel_id = v_quem or a.psicologo_id = v_quem)
     and a.status in ('agendado','confirmado')
   for update;
  if v_row.id is null then raise exception 'consulta nao encontrada ou ja encerrada'; end if;

  if v_row.status_pagamento = 'pago' then
    v_reemb := case
      when v_quem = v_row.psicologo_id then 'integral'
      when v_row.inicio - now() >= interval '24 hours' then 'integral'
      else 'nenhum'
    end;
  end if;

  update public.agendamentos a
     set status = 'cancelado',
         observacoes = coalesce(p_motivo, a.observacoes),
         reembolso = v_reemb,
         cancelado_por = v_quem,
         atualizado_em = now()
   where a.id = p_id
   returning * into v_row;

  -- A outra ponta fica sabendo (e o aviso vira push pela 032).
  v_outro := case when v_quem = v_row.psicologo_id then v_row.aluno_id else v_row.psicologo_id end;
  insert into public.notificacoes (user_id, tipo, titulo, corpo)
  values (v_outro, 'consulta', 'Consulta cancelada',
          'Uma consulta marcada para ' || to_char(v_row.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || ' foi cancelada.');

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- 4. CRP com formato válido
-- ---------------------------------------------------------------------
alter table public.psicologos add column if not exists crp_verificado_em timestamptz;

comment on column public.psicologos.crp_verificado_em is
  'Quando alguém da equipe conferiu o CRP no cadastro do Conselho. Vazio = ainda não conferido.';

create or replace function public.crp_valido(p_crp text)
returns boolean
language sql immutable as $$
  select coalesce(trim(p_crp) ~* '^(crp[ -]*)?[0-9]{2}/[0-9]{3,6}$', false)
$$;

create or replace function public.registrar_psicologo(
  p_email       text,
  p_crp         text,
  p_bio         text default '',
  p_espec       text[] default '{}',
  p_valor_reais numeric default 120
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.crp_valido(p_crp) then
    raise exception 'CRP em formato invalido: use regiao/numero, por exemplo 06/123456';
  end if;

  select id into v_id from public.perfis where lower(email) = lower(p_email);
  if v_id is null then raise exception 'crie a conta % pelo app antes de registra-la como psicologo', p_email; end if;

  update public.perfis set papel = 'psychologist' where id = v_id;

  insert into public.psicologos (id, crp, bio, especialidades, valor_centavos)
  values (v_id, trim(p_crp), p_bio, p_espec, (p_valor_reais * 100)::int)
  on conflict (id) do update
    set crp = excluded.crp, bio = excluded.bio,
        especialidades = excluded.especialidades, valor_centavos = excluded.valor_centavos;

  insert into public.psicologo_disponibilidade (psicologo_id, dia_semana, hora_inicio, hora_fim)
  select v_id, d, time '14:00', time '20:00' from generate_series(1,5) d
  on conflict do nothing;

  return v_id;
end $$;

revoke all on function public.registrar_psicologo(text, text, text, text[], numeric) from public, anon, authenticated;

commit;
