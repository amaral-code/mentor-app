-- =====================================================================
-- 026 — Professor vinculado a turma: o escopo do docente
-- =====================================================================
--
-- O BURACO QUE ESTE ARQUIVO FECHA
-- ---------------------------------------------------------------------
-- O CLAUDE.md diz que `teacher` vê "só as turmas que leciona". Isso não
-- era verdade: não existia nenhum vínculo entre professor e turma no
-- banco. `termometro_cognitivo` e os insights filtravam por ESCOLA, e
-- `sou_docente()` aceita qualquer teacher da casa.
--
-- Na prática, todo professor lia o mapa de fadiga de todas as turmas do
-- colégio, inclusive das que nunca viu. Não é exposição de conteúdo
-- (os agregados têm piso de anonimato), mas é acesso que ninguém
-- concedeu, e some sem deixar rastro justamente por parecer detalhe.
--
-- A REGRA, AGORA NO BANCO
-- ---------------------------------------------------------------------
--   teacher  -> só as turmas em que foi vinculado pela secretaria;
--   educator -> a escola inteira (é a secretaria);
--   admin    -> tudo.
--
-- Quem decide é a RLS, nunca o front: esconder um card não protege nada,
-- porque a mesma função continua chamável pelo console.
--
-- EFEITO COLATERAL ACEITO: no dia em que esta migration rodar, todo
-- professor fica sem turma até a secretaria vincular. É barulhento de
-- propósito. O contrário (herdar acesso a tudo) manteria em produção o
-- comportamento que este arquivo existe para corrigir.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tabela de vínculo
-- ---------------------------------------------------------------------
create table if not exists public.turma_professores (
  turma_id     uuid not null references public.turmas(id)  on delete cascade,
  professor_id uuid not null references public.perfis(id)  on delete cascade,
  criado_em    timestamptz not null default now(),
  criado_por   uuid references public.perfis(id) on delete set null,
  primary key (turma_id, professor_id)
);

create index if not exists turma_prof_professor_idx
  on public.turma_professores (professor_id);

comment on table public.turma_professores is
  'Quais turmas cada professor leciona. Define o escopo de leitura do papel teacher.';

alter table public.turma_professores enable row level security;

-- Leitura: o professor vê os próprios vínculos; a secretaria vê os da
-- escola dela. Escrita NUNCA direta: só pelas funções abaixo, que
-- conferem se quem chama é da mesma escola da turma.
drop policy if exists turma_prof_sel on public.turma_professores;
create policy turma_prof_sel on public.turma_professores for select
  using (
    professor_id = (select auth.uid())
    or exists (
      select 1
        from public.turmas t
        join public.perfis p on p.id = (select auth.uid())
       where t.id = turma_id
         and p.papel::text in ('educator', 'admin')
         and t.escola_id = p.escola_id
    )
  );

-- ---------------------------------------------------------------------
-- 2. minhas_turmas() — a fonte única do escopo
--
-- Devolve linhas, e não um array, para as consultas usarem
-- `in (select id from minhas_turmas())` sem conversão.
-- ---------------------------------------------------------------------
create or replace function public.minhas_turmas()
returns table (id uuid, nome text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_papel  text;
  v_escola uuid;
begin
  select p.papel::text, p.escola_id into v_papel, v_escola
    from public.perfis p where p.id = (select auth.uid());

  if v_papel is null then
    return;
  end if;

  -- Secretaria e admin enxergam a escola inteira: é o trabalho deles.
  if v_papel in ('educator', 'admin') then
    return query
      select t.id, t.nome from public.turmas t
       where t.escola_id = v_escola
       order by t.nome;
    return;
  end if;

  if v_papel = 'teacher' then
    return query
      select t.id, t.nome
        from public.turma_professores tp
        join public.turmas t on t.id = tp.turma_id
       where tp.professor_id = (select auth.uid())
       order by t.nome;
    return;
  end if;

  -- Aluno e responsável não têm turma "lecionada": devolve vazio em vez
  -- de erro, porque quem chama é tela de docente e vazio já é resposta.
  return;
end $$;

grant execute on function public.minhas_turmas() to authenticated;

create or replace function public.leciona_na_turma(p_turma uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.minhas_turmas() mt where mt.id = p_turma);
$$;

grant execute on function public.leciona_na_turma(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Secretaria vincula e desvincula
--
-- Só educator/admin, e só dentro da própria escola. O professor também
-- precisa ser da mesma escola: sem isso, uma secretaria poderia dar
-- acesso aos dados da turma dela a um professor de outro colégio.
-- ---------------------------------------------------------------------
create or replace function public.atribuir_professor_turma(
  p_professor uuid,
  p_turma     uuid
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_escola_quem  uuid;
  v_papel_quem   text;
  v_escola_turma uuid;
  v_papel_prof   text;
  v_escola_prof  uuid;
begin
  select p.papel::text, p.escola_id into v_papel_quem, v_escola_quem
    from public.perfis p where p.id = (select auth.uid());

  if v_papel_quem is null or v_papel_quem not in ('educator', 'admin') then
    raise exception 'sem_permissao: so a secretaria vincula professor a turma';
  end if;

  select t.escola_id into v_escola_turma from public.turmas t where t.id = p_turma;
  if v_escola_turma is null then
    raise exception 'turma nao encontrada';
  end if;
  if v_papel_quem <> 'admin' and v_escola_turma is distinct from v_escola_quem then
    raise exception 'sem_permissao: turma de outra escola';
  end if;

  select p.papel::text, p.escola_id into v_papel_prof, v_escola_prof
    from public.perfis p where p.id = p_professor;

  if v_papel_prof is null or v_papel_prof not in ('teacher', 'educator') then
    raise exception 'so um docente pode ser vinculado a uma turma';
  end if;
  if v_escola_prof is distinct from v_escola_turma then
    raise exception 'o docente precisa ser da mesma escola da turma';
  end if;

  insert into public.turma_professores (turma_id, professor_id, criado_por)
  values (p_turma, p_professor, (select auth.uid()))
  on conflict (turma_id, professor_id) do nothing;
end $$;

grant execute on function public.atribuir_professor_turma(uuid, uuid) to authenticated;

create or replace function public.remover_professor_turma(
  p_professor uuid,
  p_turma     uuid
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_escola_quem  uuid;
  v_papel_quem   text;
  v_escola_turma uuid;
begin
  select p.papel::text, p.escola_id into v_papel_quem, v_escola_quem
    from public.perfis p where p.id = (select auth.uid());

  if v_papel_quem is null or v_papel_quem not in ('educator', 'admin') then
    raise exception 'sem_permissao: so a secretaria desvincula professor de turma';
  end if;

  select t.escola_id into v_escola_turma from public.turmas t where t.id = p_turma;
  if v_papel_quem <> 'admin' and v_escola_turma is distinct from v_escola_quem then
    raise exception 'sem_permissao: turma de outra escola';
  end if;

  delete from public.turma_professores
   where turma_id = p_turma and professor_id = p_professor;
end $$;

grant execute on function public.remover_professor_turma(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Quem a secretaria pode vincular, e quem já está vinculado
--
-- `perfis` não abre a lista de docentes para ninguém: sai por função,
-- com três campos, e só para quem é da escola.
-- ---------------------------------------------------------------------
create or replace function public.docentes_da_escola()
returns table (id uuid, nome text, email text, papel text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_papel  text;
  v_escola uuid;
begin
  select p.papel::text, p.escola_id into v_papel, v_escola
    from public.perfis p where p.id = (select auth.uid());

  if v_papel is null or v_papel not in ('educator', 'admin') then
    raise exception 'sem_permissao: so a secretaria lista os docentes';
  end if;

  return query
    select p.id, p.nome, p.email, p.papel::text
      from public.perfis p
     where p.escola_id = v_escola
       and p.papel::text in ('teacher', 'educator')
     order by p.nome;
end $$;

grant execute on function public.docentes_da_escola() to authenticated;

create or replace function public.professores_da_turma(p_turma uuid)
returns table (id uuid, nome text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.leciona_na_turma(p_turma) then
    raise exception 'sem_permissao: turma fora do seu escopo';
  end if;

  return query
    select p.id, p.nome, p.email
      from public.turma_professores tp
      join public.perfis p on p.id = tp.professor_id
     where tp.turma_id = p_turma
     order by p.nome;
end $$;

grant execute on function public.professores_da_turma(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. O termômetro passa a respeitar o escopo
--
-- Mesma função da 022, com UMA mudança: as turmas saem de
-- `minhas_turmas()` em vez de "todas as da escola". O piso de anonimato
-- de 5 alunos continua, e continua sendo o que impede o agregado de
-- virar retrato de um aluno específico.
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
  v_dias integer := greatest(1, least(coalesce(p_dias, 1), 30));
  v_minimo constant integer := 5;
begin
  if not public.sou_docente() then
    raise exception 'sem_permissao: so docente/educador le o termometro cognitivo';
  end if;

  return query
  with escopo as (
    select mt.id from public.minhas_turmas() mt
  ),
  alunos as (
    select p.id, p.turma_id
      from public.perfis p
     where p.papel::text = 'student'
       and p.turma_id in (select id from escopo)
  ),
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
  where tm.id in (select id from escopo)
  group by tm.id, tm.nome
  having count(i.user_id) >= v_minimo
  order by
    (count(*) filter (where i.classe in ('fadiga','esgotamento')))::numeric
      / nullif(count(i.user_id), 0) desc nulls last,
    tm.nome;
end $$;

comment on function public.termometro_cognitivo(integer) is
  'Mapa de calor anonimo por turma, limitado as turmas do proprio docente. Minimo de 5 alunos medidos.';

revoke all on function public.termometro_cognitivo(integer) from public, anon;
grant execute on function public.termometro_cognitivo(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Insights de dificuldade: agora o professor também lê, no escopo
--
-- Antes era só educator/admin, e sobre a escola inteira. O professor é
-- justamente quem faz alguma coisa com "metade da turma errou função
-- afim" — mas sobre a turma dele, não sobre o colégio.
-- ---------------------------------------------------------------------
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

  -- `minhas_turmas()` e chamada de novo em cada bloco, e nao guardada
  -- numa tabela temporaria: temp table dentro de SECURITY DEFINER depende
  -- de privilegio no schema pg_temp e de estar numa transacao, e isso
  -- quebra em ambiente que a funcao deveria ignorar. A funcao e barata.
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
     group by 1, 2
  ),
  agregado as (
    select j.materia,
           coalesce(j.topico, '') as topico,
           count(distinct j.user_id) filter (where j.erros > j.acertos)::integer as com_dificuldade,
           sum(j.erros)::bigint    as erros,
           sum(j.acertos + j.erros)::bigint as respostas
      from janela j
     group by 1, 2
  )
  select a.materia,
         a.topico,
         a.com_dificuldade,
         v_total_alunos,
         case when v_total_alunos = 0 then 0
              else round(a.com_dificuldade::numeric / v_total_alunos, 3) end,
         a.erros,
         a.respostas,
         coalesce(v.perguntas, 0)
    from agregado a
    left join volume v on v.materia = a.materia and v.topico = a.topico
   where a.respostas > 0
   order by a.com_dificuldade desc, a.erros desc
   limit 20;
end $$;

revoke all on function public.insights_turma_24h(integer) from public, anon;
grant execute on function public.insights_turma_24h(integer) to authenticated;

commit;

-- =====================================================================
-- Verificacao:
--   como educator:  select * from public.minhas_turmas();        -- escola inteira
--   como teacher:   select * from public.minhas_turmas();        -- so as vinculadas
--   como aluno:     select * from public.termometro_cognitivo(); -- sem_permissao
-- =====================================================================
