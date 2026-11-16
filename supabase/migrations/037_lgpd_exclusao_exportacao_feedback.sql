-- =====================================================================
-- 037 — LGPD: exportar e excluir a conta; feedback do beta (M8)
-- =====================================================================
--
-- 1. EXPORTAÇÃO (#70, LGPD art. 18, II e V)
--    `exportar_meus_dados()` devolve num JSON só tudo o que o banco guarda
--    da pessoa logada. A lista de tabelas é DESCOBERTA pelo catálogo
--    (toda tabela com coluna `user_id`), para a próxima tabela nascer já
--    incluída; as que ligam a pessoa por outra coluna estão escritas à
--    mão. Fica de fora só o que é técnico ou é chave: inscrição de push
--    (endpoint e chaves do navegador) e o registro de operações da fila
--    offline.
--    O paciente NÃO recebe o prontuário por aqui: a guarda é do
--    profissional (CFP Res. 001/2009), e o acesso do paciente ao
--    prontuário é pedido a ele. O psicólogo recebe as notas que escreveu.
--
-- 2. EXCLUSÃO (#70, exigência das lojas)
--    Quem apaga é o back-end (`/api/conta/excluir`), com a API de admin
--    do Supabase: apagar `auth.users` leva `perfis` e, em cascata, todas
--    as tabelas do usuário. Antes disso o back-end chama
--    `preparar_exclusao_conta`, que:
--      • PRESERVA O PRONTUÁRIO de quem foi paciente. O psicólogo é
--        obrigado a guardá-lo por 5 anos (CFP Res. 001/2009, art. 8º),
--        e a LGPD (art. 16, I) permite reter dado para cumprir obrigação
--        legal. A nota perde o vínculo com a conta e guarda só o nome do
--        paciente, para o profissional saber de quem é.
--      • registra a exclusão SEM dado pessoal (papel e data), para
--        provar que o pedido foi atendido.
--
-- 3. FEEDBACK DO BETA (#74)
--    `enviar_feedback`: ideia, problema ou elogio, com nota de 0 a 10
--    opcional (NPS). Dez por dia por pessoa. Quem lê é a equipe, pelo
--    SQL Editor (`verificacao/metricas_beta.sql`); o app não tem tela
--    para ler o feedback dos outros.
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Exportação
-- ---------------------------------------------------------------------
create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_saida  jsonb;
  v_linhas jsonb;
  t        record;
  -- Técnicas ou com chave: não são "dados da pessoa" que ela leve embora.
  v_fora   text[] := array['push_inscricoes', 'push_assinaturas', 'operacoes_sincronizadas', 'contas_demo'];
begin
  if v_user is null then raise exception 'nao autenticado'; end if;

  v_saida := jsonb_build_object(
    'gerado_em', now(),
    'formato', 'Midnight Mentor, exportação de dados pessoais (LGPD art. 18)',
    'perfil', (select to_jsonb(p) from public.perfis p where p.id = v_user)
  );

  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'user_id'
       and c.table_name <> all (v_fora)
     order by c.table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.user_id = $1', t.table_name)
       into v_linhas using v_user;
    if jsonb_array_length(v_linhas) > 0 then
      v_saida := v_saida || jsonb_build_object(t.table_name, v_linhas);
    end if;
  end loop;

  -- Tabelas que ligam a pessoa por outra coluna.
  v_saida := v_saida || jsonb_strip_nulls(jsonb_build_object(
    'vinculos_responsavel', (select jsonb_agg(to_jsonb(x)) from public.vinculos_responsavel x where v_user in (x.aluno_id, x.responsavel_id)),
    'agendamentos',         (select jsonb_agg(to_jsonb(x)) from public.agendamentos x where v_user in (x.aluno_id, x.responsavel_id, x.psicologo_id)),
    'consentimentos_dados', (select jsonb_agg(to_jsonb(x)) from public.consentimentos_dados x where v_user in (x.aluno_id, x.concedido_por)),
    'alertas_saude_mental', (select jsonb_agg(to_jsonb(x)) from public.alertas_saude_mental x where x.aluno_id = v_user),
    'mensagens_apoio',      (select jsonb_agg(to_jsonb(x)) from public.mensagens_apoio x where v_user in (x.participante_id, x.autor_id)),
    'mensagens_comunidade', (select jsonb_agg(to_jsonb(x)) from public.mensagens_comunidade x where x.autor_id = v_user),
    'ligas_criadas',        (select jsonb_agg(to_jsonb(x)) from public.ligas x where x.criador_id = v_user),
    'avaliacoes_feitas',    (select jsonb_agg(jsonb_build_object('agendamento_id', x.agendamento_id, 'nota', x.nota, 'comentario', x.comentario, 'criado_em', x.criado_em))
                               from public.avaliacoes_psicologo x where x.autor_id = v_user),
    'psicologo',            (select to_jsonb(x) from public.psicologos x where x.id = v_user),
    'prontuario_escrito',   (select jsonb_agg(to_jsonb(x)) from public.prontuario_notas x where x.psicologo_id = v_user)
  ));

  return v_saida;
end $$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Exclusão
-- ---------------------------------------------------------------------

-- Prontuário de quem foi paciente sobrevive à exclusão da conta.
alter table public.prontuario_notas alter column aluno_id drop not null;
alter table public.prontuario_notas add column if not exists paciente_excluido text;
alter table public.prontuario_notas drop constraint if exists prontuario_notas_aluno_id_fkey;
alter table public.prontuario_notas
  add constraint prontuario_notas_aluno_id_fkey
  foreign key (aluno_id) references public.perfis(id) on delete set null;

comment on column public.prontuario_notas.paciente_excluido is
  'Nome do paciente quando a conta dele foi excluída. A nota fica com o profissional pelo prazo legal.';

-- A retificação apontava para a nota corrigida com RESTRICT: quando o
-- psicólogo exclui a própria conta, as notas saem juntas em cascata e o
-- RESTRICT barrava a exclusão no meio. Continua impossível apagar só a
-- nota original (não há policy de delete); na cascata, saem as duas.
alter table public.prontuario_notas drop constraint if exists prontuario_notas_retifica_id_fkey;
alter table public.prontuario_notas
  add constraint prontuario_notas_retifica_id_fkey
  foreign key (retifica_id) references public.prontuario_notas(id) on delete cascade;

create table if not exists public.exclusoes_conta (
  id          bigint generated always as identity primary key,
  papel       text not null,
  excluida_em timestamptz not null default now()
);
-- Sem policy: ninguém lê pelo app. Não guarda id, nome nem e-mail.
alter table public.exclusoes_conta enable row level security;

create or replace function public.preparar_exclusao_conta(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nome  text;
  v_papel text;
  v_notas integer;
begin
  select p.nome, p.papel::text into v_nome, v_papel from public.perfis p where p.id = p_user;
  if v_papel is null then raise exception 'perfil nao encontrado'; end if;

  update public.prontuario_notas n
     set paciente_excluido = coalesce(nullif(trim(v_nome), ''), 'paciente sem nome')
   where n.aluno_id = p_user;
  get diagnostics v_notas = row_count;

  insert into public.exclusoes_conta (papel) values (v_papel);

  return jsonb_build_object('papel', v_papel, 'notas_preservadas', v_notas);
end $$;

-- Só o back-end (service_role) chama: é o passo antes de apagar a conta.
revoke all on function public.preparar_exclusao_conta(uuid) from public, anon, authenticated;
grant execute on function public.preparar_exclusao_conta(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 3. Feedback do beta
-- ---------------------------------------------------------------------
create table if not exists public.feedback_beta (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.perfis(id) on delete cascade,
  tipo      text not null check (tipo in ('ideia', 'problema', 'elogio')),
  nota      smallint check (nota between 0 and 10),
  texto     text not null check (char_length(trim(texto)) between 1 and 2000),
  tela      text check (char_length(tela) <= 60),
  versao    text check (char_length(versao) <= 40),
  criado_em timestamptz not null default now()
);

create index if not exists feedback_beta_criado_idx on public.feedback_beta (criado_em desc);

alter table public.feedback_beta enable row level security;

drop policy if exists feedback_le_o_proprio on public.feedback_beta;
create policy feedback_le_o_proprio on public.feedback_beta
  for select using (user_id = (select auth.uid()));
-- Escrita só pela função (que aplica o limite diário).

create or replace function public.enviar_feedback(
  p_tipo   text,
  p_texto  text,
  p_nota   smallint default null,
  p_tela   text default null,
  p_versao text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if (select count(*) from public.feedback_beta f
       where f.user_id = v_user and f.criado_em > now() - interval '1 day') >= 10 then
    raise exception 'limite de feedback do dia atingido';
  end if;

  insert into public.feedback_beta (user_id, tipo, nota, texto, tela, versao)
  values (v_user, p_tipo, p_nota, trim(p_texto), left(p_tela, 60), left(p_versao, 40))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.enviar_feedback(text, text, smallint, text, text) from public, anon;
grant execute on function public.enviar_feedback(text, text, smallint, text, text) to authenticated;

commit;
