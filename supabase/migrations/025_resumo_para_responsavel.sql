-- =====================================================================
-- 025 — Resumo do estudante para o responsável (números REAIS)
-- =====================================================================
--
-- O QUE ESTE ARQUIVO CONSERTA
-- ---------------------------------------------------------------------
-- O painel dos pais (`ParentsDashboard`) era 100% inventado: nome fixo
-- ("Pedro Henrique"), 12 meses de notas escritas à mão e uma análise de
-- IA rodando em cima disso. Relatório de IA sobre dado falso é pior que
-- não ter relatório — ele parece verdadeiro.
--
-- POR QUE PRECISA DE FUNÇÃO, E NÃO DE POLICY
-- ---------------------------------------------------------------------
-- `telemetria_estudo` é 100% do aluno (011): o responsável NÃO lê, e
-- isso é de propósito. Cada linha ali é uma questão específica, com
-- matéria, dificuldade, hora e acerto — é conteúdo, não padrão. Abrir a
-- tabela para o responsável mudaria o trato que sustenta o app: o aluno
-- responde com honestidade porque sabe que ninguém está lendo por cima
-- do ombro.
--
-- Então o responsável não ganha acesso à tabela. Ganha acesso ao
-- AGREGADO: quantos minutos, quantas questões, que proporção de acerto,
-- em quantos dias. Nenhuma função aqui devolve enunciado, id de questão
-- ou horário de uma resposta isolada.
--
-- O QUE CONTINUA FORA, mesmo agregado: conversa com o Mentor, caderno e
-- registro de humor escrito pelo estudante (a regra do PainelCuidado).
--
-- NOTA ESCOLAR NÃO EXISTE NESTE BANCO. Nenhuma tabela guarda boletim; o
-- gráfico "Desempenho Escolar" do painel antigo não tinha de onde vir.
-- O que existe de desempenho é o do próprio app (acerto nos exercícios
-- e nota de redação), e é isso que estas funções devolvem — com esse
-- nome, para ninguém ler como boletim.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guarda única do arquivo.
--
-- Em função só, e não repetida em cada uma, para não existir o dia em
-- que alguém acrescenta a quarta função e esquece da checagem.
-- ---------------------------------------------------------------------
create or replace function public.pode_ver_resumo(p_aluno uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_aluno = (select auth.uid()) or public.sou_responsavel_de(p_aluno);
$$;

grant execute on function public.pode_ver_resumo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1. resumo_mensal_aluno — a série temporal do painel
--
-- Um mês por linha, do mais antigo para o mais novo, incluindo os meses
-- SEM atividade: um buraco no meio da série é exatamente o sinal que o
-- responsável precisa ver, e some se a linha não existir.
-- ---------------------------------------------------------------------
create or replace function public.resumo_mensal_aluno(
  p_aluno uuid,
  p_meses integer default 6
)
returns table (
  mes           date,
  minutos       integer,
  questoes      integer,
  acertos       integer,
  taxa_acerto   integer,
  dias_ativos   integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_meses integer := least(greatest(coalesce(p_meses, 6), 1), 24);
begin
  if not public.pode_ver_resumo(p_aluno) then
    raise exception 'sem permissao para ver o resumo deste estudante';
  end if;

  return query
  with meses as (
    select generate_series(
             date_trunc('month', current_date) - ((v_meses - 1) || ' months')::interval,
             date_trunc('month', current_date),
             interval '1 month'
           )::date as mes
  ),
  dados as (
    select date_trunc('month', t.criado_em)::date            as mes,
           sum(t.tempo_gasto_segundos)                       as segundos,
           count(*)                                          as questoes,
           count(*) filter (where t.acertou)                 as acertos,
           count(distinct t.criado_em::date)                 as dias
      from public.telemetria_estudo t
     where t.user_id = p_aluno
       and t.criado_em >= date_trunc('month', current_date)
                          - ((v_meses - 1) || ' months')::interval
     group by 1
  )
  select m.mes,
         coalesce(round(d.segundos / 60.0)::integer, 0),
         coalesce(d.questoes, 0)::integer,
         coalesce(d.acertos, 0)::integer,
         -- Mês sem questão devolve 0, e não NULL: o gráfico desenha o
         -- zero; com NULL a linha "pula" o mês e some o buraco.
         case when coalesce(d.questoes, 0) = 0 then 0
              else round(d.acertos * 100.0 / d.questoes)::integer end,
         coalesce(d.dias, 0)::integer
    from meses m
    left join dados d on d.mes = m.mes
   order by m.mes;
end $$;

grant execute on function public.resumo_mensal_aluno(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. resumo_semanal_aluno — as últimas semanas, para o gráfico de barras
--
-- A semana começa na segunda (`date_trunc('week')` do Postgres é ISO),
-- que é como a família lê "a semana passada".
-- ---------------------------------------------------------------------
create or replace function public.resumo_semanal_aluno(
  p_aluno   uuid,
  p_semanas integer default 4
)
returns table (
  semana   date,
  minutos  integer,
  questoes integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_semanas integer := least(greatest(coalesce(p_semanas, 4), 1), 12);
begin
  if not public.pode_ver_resumo(p_aluno) then
    raise exception 'sem permissao para ver o resumo deste estudante';
  end if;

  return query
  with semanas as (
    select generate_series(
             date_trunc('week', current_date) - ((v_semanas - 1) || ' weeks')::interval,
             date_trunc('week', current_date),
             interval '1 week'
           )::date as semana
  ),
  dados as (
    select date_trunc('week', t.criado_em)::date as semana,
           sum(t.tempo_gasto_segundos)           as segundos,
           count(*)                              as questoes
      from public.telemetria_estudo t
     where t.user_id = p_aluno
       and t.criado_em >= date_trunc('week', current_date)
                          - ((v_semanas - 1) || ' weeks')::interval
     group by 1
  )
  select s.semana,
         coalesce(round(d.segundos / 60.0)::integer, 0),
         coalesce(d.questoes, 0)::integer
    from semanas s
    left join dados d on d.semana = s.semana
   order by s.semana;
end $$;

grant execute on function public.resumo_semanal_aluno(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. materias_aluno — onde ele acerta e onde ele apanha
--
-- Nome da matéria é padrão, não conteúdo: dizer "Matemática vai mal" não
-- entrega nenhuma resposta específica. É o dado que transforma o painel
-- em conversa ("quer ajuda em matemática?") em vez de cobrança.
--
-- Matéria com menos de 5 questões fica de fora: 1 de 1 errada vira
-- "0% em Biologia" e assusta sem significar nada.
-- ---------------------------------------------------------------------
create or replace function public.materias_aluno(
  p_aluno uuid,
  p_meses integer default 3
)
returns table (
  materia     text,
  questoes    integer,
  acertos     integer,
  taxa_acerto integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_meses integer := least(greatest(coalesce(p_meses, 3), 1), 24);
begin
  if not public.pode_ver_resumo(p_aluno) then
    raise exception 'sem permissao para ver o resumo deste estudante';
  end if;

  return query
  select coalesce(nullif(trim(t.materia), ''), 'Geral')::text,
         count(*)::integer,
         count(*) filter (where t.acertou)::integer,
         round(count(*) filter (where t.acertou) * 100.0 / count(*))::integer
    from public.telemetria_estudo t
   where t.user_id = p_aluno
     and t.criado_em >= current_date - ((v_meses) || ' months')::interval
   group by 1
  having count(*) >= 5
   order by 4 asc, 2 desc;
end $$;

grant execute on function public.materias_aluno(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4. ficha_aluno — quem é o estudante, na visão do responsável
--
-- O responsável já vê o nome pela lista de vínculos; o que falta é
-- escola e turma para o cabeçalho do painel deixar de ser texto fixo.
-- Vai por função porque a policy de `perfis` não abre o perfil do filho
-- para o responsável, e não é para abrir: aqui saem quatro campos, não
-- a linha inteira.
-- ---------------------------------------------------------------------
create or replace function public.ficha_aluno(p_aluno uuid)
returns table (
  nome    text,
  escola  text,
  turma   text,
  desde   timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pode_ver_resumo(p_aluno) then
    raise exception 'sem permissao para ver este estudante';
  end if;

  return query
  select p.nome,
         e.nome,
         t.nome,
         p.criado_em
    from public.perfis p
    left join public.escolas e on e.id = p.escola_id
    left join public.turmas  t on t.id = p.turma_id
   where p.id = p_aluno;
end $$;

grant execute on function public.ficha_aluno(uuid) to authenticated;
