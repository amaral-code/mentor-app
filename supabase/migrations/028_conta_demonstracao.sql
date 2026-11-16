-- =====================================================================
-- 028 — Contas de demonstração: uma por perfil, num mundo isolado
-- =====================================================================
--
-- DECISÃO DOS DONOS DO PRODUTO
-- ---------------------------------------------------------------------
-- A equipe apresenta o produto aos professores orientadores com UMA
-- CONTA POR PERFIL: aluno, responsável, professor, secretaria e
-- psicólogo. As cinco são criadas pelo app, como qualquer conta, e
-- `preparar_demonstracao` (só pelo SQL Editor) dá a cada uma o seu
-- papel e as liga entre si.
--
-- Chegou a existir a ideia de UM login que trocasse de papel pela tela.
-- Foi descartada: exigiria abrir uma exceção na trava de `perfis`
-- (003/007), que existe porque dava para "virar educador pelo console".
-- Com uma conta por perfil, a trava fica intacta: nenhuma conta muda de
-- papel pelo app, nem as de demonstração.
--
-- O RISCO DE SAÚDE MENTAL, E OS DOIS MUNDOS
-- ---------------------------------------------------------------------
-- A conta de demonstração "psicólogo" não é de um profissional. Se
-- aparecesse na vitrine para alunos REAIS, um menor de verdade poderia
-- marcar consulta e liberar dado de saúde mental para quem não tem CRP.
-- No sentido contrário, o "aluno" de demonstração marcaria consulta
-- real com psicólogo real. Por isso:
--
--   - a vitrine mostra à conta de demonstração só psicólogos de
--     demonstração, e aos usuários reais só os reais;
--   - triggers em agendamento, consentimento e vínculo de responsável
--     recusam qualquer ligação entre os dois mundos, venha de qual
--     função vier.
--
-- Os alunos fictícios usam e-mail em `.invalid` (domínio reservado, RFC
-- 2606): nenhum e-mail chega a alguém de verdade, e ninguém entra com
-- eles.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Quem é de demonstração
-- ---------------------------------------------------------------------
create table if not exists public.contas_demo (
  user_id    uuid primary key references public.perfis(id) on delete cascade,
  -- true: uma das cinco contas da equipe, que faz login.
  -- false: aluno fictício, que existe só para os painéis terem dados.
  da_equipe  boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- RLS ligada e NENHUMA policy: é isso que impede alguém de se colocar
-- na lista pelo app.
alter table public.contas_demo enable row level security;

-- Uma linha só: onde fica a escola de demonstração.
create table if not exists public.demonstracao (
  id         integer primary key default 1 check (id = 1),
  escola_id  uuid not null references public.escolas(id) on delete cascade,
  turma_id   uuid not null references public.turmas(id)  on delete cascade,
  criado_em  timestamptz not null default now()
);
alter table public.demonstracao enable row level security;

create or replace function public.e_conta_demo(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contas_demo d where d.user_id = p_user);
$$;

-- Só as funções usam: perguntar "este id é demonstração?" sobre qualquer
-- id não tem uso legítimo no cliente.
revoke execute on function public.e_conta_demo(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Os dois mundos não se misturam
-- ---------------------------------------------------------------------
create or replace function public.mesmo_mundo(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.e_conta_demo(p_a) = public.e_conta_demo(p_b);
$$;
revoke execute on function public.mesmo_mundo(uuid, uuid) from public, anon, authenticated;

create or replace function public.trava_mundo_agendamento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.mesmo_mundo(new.aluno_id, new.psicologo_id) then
    raise exception 'demonstracao: consulta entre conta de demonstracao e conta real nao e permitida';
  end if;
  return new;
end $$;

drop trigger if exists agendamentos_mundo on public.agendamentos;
create trigger agendamentos_mundo before insert on public.agendamentos
  for each row execute function public.trava_mundo_agendamento();

create or replace function public.trava_mundo_consentimento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.mesmo_mundo(new.aluno_id, new.psicologo_id) then
    raise exception 'demonstracao: consentimento entre conta de demonstracao e conta real nao e permitido';
  end if;
  return new;
end $$;

drop trigger if exists consentimentos_mundo on public.consentimentos_dados;
create trigger consentimentos_mundo before insert on public.consentimentos_dados
  for each row execute function public.trava_mundo_consentimento();

create or replace function public.trava_mundo_vinculo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.mesmo_mundo(new.aluno_id, new.responsavel_id) then
    raise exception 'demonstracao: vinculo entre conta de demonstracao e conta real nao e permitido';
  end if;
  return new;
end $$;

drop trigger if exists vinculos_mundo on public.vinculos_responsavel;
create trigger vinculos_mundo before insert on public.vinculos_responsavel
  for each row execute function public.trava_mundo_vinculo();

-- Como secretaria ou professor, a conta leria agregados da escola em que
-- estiver. Ela não sai da escola de demonstração.
create or replace function public.trava_escola_demo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_escola_demo uuid;
begin
  if new.escola_id is distinct from old.escola_id
     and new.escola_id is not null
     and public.e_conta_demo(new.id) then
    select d.escola_id into v_escola_demo from public.demonstracao d where d.id = 1;
    if new.escola_id is distinct from v_escola_demo then
      raise exception 'demonstracao: a conta de demonstracao so pode estar na escola de demonstracao';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists perfis_escola_demo on public.perfis;
create trigger perfis_escola_demo before update on public.perfis
  for each row execute function public.trava_escola_demo();

-- A vitrine: cada mundo vê só os seus psicólogos.
--
-- A view não pode chamar `e_conta_demo` direto: função chamada dentro de
-- view é checada com a permissão de quem CONSULTA, e o cliente não tem
-- execute nela (e não deve ter). Esta responde só o que a vitrine já
-- mostra, e só sobre quem é psicólogo; para qualquer outro id devolve
-- false, sem dizer se a pessoa é de demonstração.
create or replace function public.psicologo_visivel(p_psicologo uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.psicologos ps where ps.id = p_psicologo)
     and public.e_conta_demo(p_psicologo) = public.e_conta_demo((select auth.uid()));
$$;

grant execute on function public.psicologo_visivel(uuid) to authenticated;

create or replace view public.catalogo_psicologos as
  select ps.id, p.nome, p.avatar_url,
         ps.crp, ps.bio, ps.especialidades, ps.abordagem,
         ps.valor_centavos, ps.duracao_minutos, ps.foto_url,
         ps.aceita_novos, ps.atende_adolescente, ps.nota_media,
         ps.total_atendimentos, ps.fuso, ps.total_avaliacoes
    from public.psicologos ps
    join public.perfis p on p.id = ps.id
   where p.papel::text = 'psychologist'
     and public.psicologo_visivel(ps.id);

grant select on public.catalogo_psicologos to authenticated;

-- ---------------------------------------------------------------------
-- 3. preparar_demonstracao — rodar UMA vez no SQL Editor
--
-- Recebe os e-mails das cinco contas, já criadas pelo app, e monta:
--
--   escola e turma de demonstração, com seis alunos fictícios e três
--   meses de estudo (seis, e não cinco: o termômetro esconde turma com
--   menos de 5 alunos medidos, e no piso exato qualquer ajuste apagaria
--   o painel na frente da banca);
--
--   ALUNO        15 anos, na turma, com histórico de estudo. Menor de
--                16 de propósito: na apresentação, o consentimento ao
--                psicólogo precisa passar pelo responsável, que é a
--                regra da LGPD funcionando ao vivo;
--   RESPONSÁVEL  com vínculo ativo com o aluno;
--   PROFESSOR    vinculado à turma;
--   SECRETARIA   da escola de demonstração;
--   PSICÓLOGO    CRP "DEMONSTRAÇÃO", com consulta marcada com o aluno e
--                um paciente fictício de 17 anos com consentimento,
--                prontuário e conversa.
--
-- Roda no SQL Editor, onde não há `auth.uid()`, então a trava de
-- `perfis` não se aplica: é o mesmo caminho de `registrar_psicologo`.
-- ---------------------------------------------------------------------
create or replace function public.preparar_demonstracao(
  p_aluno       text,
  p_responsavel text,
  p_professor   text,
  p_secretaria  text,
  p_psicologo   text
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_aluno  uuid;
  v_resp   uuid;
  v_prof   uuid;
  v_sec    uuid;
  v_psi    uuid;
  v_escola uuid;
  v_turma  uuid;
  v_ficticios uuid[] := '{}';
  v_id     uuid;
  v_nomes  text[] := array['Ana Beatriz', 'Bruno Costa', 'Camila Duarte', 'Diego Nunes', 'Elisa Prado', 'Felipe Rocha'];
  v_mats   text[] := array['Matemática', 'Português', 'Biologia', 'História', 'Física', 'Química'];
  v_todos  uuid[];
  i        integer;
  d        integer;
  q        integer;
  v_score  integer;
begin
  if exists (select 1 from public.demonstracao) then
    raise exception 'a demonstracao ja existe. Rode limpar_demonstracao() antes de preparar de novo.';
  end if;

  select p.id into v_aluno from public.perfis p where lower(p.email) = lower(trim(p_aluno));
  select p.id into v_resp  from public.perfis p where lower(p.email) = lower(trim(p_responsavel));
  select p.id into v_prof  from public.perfis p where lower(p.email) = lower(trim(p_professor));
  select p.id into v_sec   from public.perfis p where lower(p.email) = lower(trim(p_secretaria));
  select p.id into v_psi   from public.perfis p where lower(p.email) = lower(trim(p_psicologo));

  if v_aluno is null or v_resp is null or v_prof is null or v_sec is null or v_psi is null then
    raise exception 'crie as cinco contas pelo app antes. Faltando: %',
      concat_ws(', ',
        case when v_aluno is null then p_aluno end,
        case when v_resp  is null then p_responsavel end,
        case when v_prof  is null then p_professor end,
        case when v_sec   is null then p_secretaria end,
        case when v_psi   is null then p_psicologo end);
  end if;

  if cardinality(array(select distinct x from unnest(array[v_aluno, v_resp, v_prof, v_sec, v_psi]) x)) < 5 then
    raise exception 'use cinco contas diferentes, uma por perfil';
  end if;

  -- Escola e turma
  insert into public.escolas (nome, cidade) values ('Escola de Demonstração', 'Demonstração')
  returning id into v_escola;
  insert into public.turmas (escola_id, nome, ano) values (v_escola, '3º Ano A (demonstração)', '3')
  returning id into v_turma;
  insert into public.demonstracao (id, escola_id, turma_id) values (1, v_escola, v_turma);

  -- As cinco contas entram no mundo de demonstração ANTES de qualquer
  -- vínculo: os triggers acima recusariam ligar conta real a fictícia.
  insert into public.contas_demo (user_id, da_equipe)
  select x, true from unnest(array[v_aluno, v_resp, v_prof, v_sec, v_psi]) x
  on conflict (user_id) do update set da_equipe = true;

  update public.perfis set papel = 'student', escola_id = v_escola, turma_id = v_turma,
         onboarding_completed = true, data_nascimento = current_date - interval '15 years'
   where id = v_aluno;
  update public.perfis set papel = 'parent', onboarding_completed = true where id = v_resp;
  update public.perfis set papel = 'teacher', escola_id = v_escola, onboarding_completed = true where id = v_prof;
  update public.perfis set papel = 'educator', escola_id = v_escola, onboarding_completed = true where id = v_sec;
  update public.perfis set papel = 'psychologist', onboarding_completed = true where id = v_psi;

  -- Alunos fictícios
  for i in 1..6 loop
    v_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_id, 'aluno' || i || '.demonstracao@midnightmentor.invalid',
            jsonb_build_object('nome', v_nomes[i] || ' (demonstração)'));
    update public.perfis
       set escola_id = v_escola, turma_id = v_turma, onboarding_completed = true,
           data_nascimento = current_date - interval '17 years'
     where id = v_id;
    insert into public.contas_demo (user_id) values (v_id);
    v_ficticios := v_ficticios || v_id;
  end loop;

  -- Estudo e cansaço: o aluno da equipe (posição 7) e os seis fictícios.
  -- O aluno da equipe vem caindo nos últimos meses, para o painel dos
  -- pais ter tendência e matéria fraca para mostrar.
  v_todos := v_ficticios || v_aluno;
  for i in 1..7 loop
    for d in 0..85 by 3 loop
      for q in 1..(3 + (i % 3)) loop
        insert into public.telemetria_estudo
          (user_id, question_id, materia, tempo_gasto_segundos, acertou, hora_local, criado_em)
        values (
          v_todos[i],
          'demo-' || i || '-' || d || '-' || q,
          v_mats[1 + ((q + i) % 6)],
          60 + (q * 13) % 90,
          ((q * 7 + d + i * 5) % 10) < (case when i = 7 then 3 + d / 20 else 4 + i % 4 end),
          case when i = 7 and d < 15 then 1 else 20 end,
          now() - make_interval(days => d)
        );
      end loop;
    end loop;

    for d in 0..29 loop
      v_score := least(95, 20 + i * 8 + (d % 7) * 3);
      insert into public.indice_burnout (user_id, data, score, classe)
      values (
        v_todos[i], current_date - d, v_score,
        (case when v_score >= 75 then 'esgotamento'
              when v_score >= 60 then 'fadiga'
              when v_score >= 45 then 'alerta'
              else 'saudavel' end)::public.classe_burnout
      )
      on conflict (user_id, data) do nothing;
    end loop;

    insert into public.focus_metrics (user_id, session_date, focused_minutes, distraction_count)
    values (v_todos[i], current_date, 25 + i * 5, i % 4);

    insert into public.quiz_desempenho_topicos (user_id, materia, topico, acertos, erros, atualizado_em)
    values (v_todos[i], 'Matemática', 'Função afim', 1 + i % 2, 3 + i % 3, now())
    on conflict (user_id, materia, topico) do nothing;
  end loop;

  -- Responsável acompanha o aluno da equipe.
  insert into public.vinculos_responsavel (responsavel_id, aluno_id, parentesco, status, respondido_em)
  values (v_resp, v_aluno, 'responsavel', 'ativo', now())
  on conflict (responsavel_id, aluno_id) do nothing;

  -- Professor da turma.
  insert into public.turma_professores (turma_id, professor_id, criado_por)
  values (v_turma, v_prof, v_sec)
  on conflict do nothing;

  -- Psicólogo
  insert into public.psicologos (id, crp, bio, especialidades, abordagem, valor_centavos)
  values (v_psi, 'DEMONSTRAÇÃO', 'Perfil de demonstração. Não é um profissional real.',
          array['ansiedade de prova', 'rotina de estudo'], 'Demonstração', 0)
  on conflict (id) do update set crp = excluded.crp, bio = excluded.bio;

  insert into public.psicologo_disponibilidade (psicologo_id, dia_semana, hora_inicio, hora_fim)
  select v_psi, dd, time '18:00', time '21:00' from generate_series(1, 5) dd
  on conflict do nothing;

  -- Com o aluno da equipe: uma consulta passada e uma futura, SEM
  -- consentimento. Na apresentação, o psicólogo vê "não liberado", e o
  -- responsável libera ao vivo.
  -- Sala Jitsi de verdade na consulta futura: sem link, a lista mostra
  -- "sala após o pagamento", que numa consulta sem custo não faz sentido.
  insert into public.agendamentos (aluno_id, responsavel_id, psicologo_id, inicio, fim, status, status_pagamento, meeting_provider, meeting_url)
  values
    (v_aluno, v_resp, v_psi, now() - interval '7 days', now() - interval '7 days' + interval '50 minutes',
     'concluido', 'isento', 'jitsi', null),
    (v_aluno, v_resp, v_psi, now() + interval '3 days', now() + interval '3 days' + interval '50 minutes',
     'confirmado', 'isento', 'jitsi',
     'https://meet.jit.si/MidnightMentorDemonstracao' || substr(md5(random()::text), 1, 8));

  insert into public.mensagens_apoio (psicologo_id, participante_id, autor_id, texto, criado_em)
  values
    (v_psi, v_aluno, v_psi, 'Oi! Como foi a semana com os blocos curtos de estudo?', now() - interval '2 days'),
    (v_psi, v_aluno, v_aluno, 'Funcionou nos dias de folga. Podemos falar disso na próxima?', now() - interval '1 day');

  -- Com um paciente fictício de 17 anos: o caminho completo, com
  -- consentimento dado por ele mesmo, prontuário e retificação.
  insert into public.agendamentos (aluno_id, psicologo_id, inicio, fim, status, status_pagamento, meeting_provider)
  values (v_ficticios[2], v_psi, now() - interval '14 days', now() - interval '14 days' + interval '50 minutes',
          'concluido', 'isento', 'manual');

  insert into public.consentimentos_dados (aluno_id, psicologo_id, concedido_por, escopo, valido_ate)
  values (v_ficticios[2], v_psi, v_ficticios[2], array['bem_estar', 'estudo'], now() + interval '90 days');

  insert into public.prontuario_notas (psicologo_id, aluno_id, texto, criado_em)
  values (v_psi, v_ficticios[2],
          'Anotação de demonstração. Relata cansaço depois do turno de trabalho e dificuldade de manter rotina.',
          now() - interval '14 days')
  returning id into v_id;

  insert into public.prontuario_notas (psicologo_id, aluno_id, tipo, retifica_id, texto, criado_em)
  values (v_psi, v_ficticios[2], 'retificacao', v_id,
          'Retificação de demonstração: a queixa principal é ansiedade de desempenho.',
          now() - interval '13 days');

  return 'Demonstração pronta. Entre com cada uma das cinco contas.';
end $$;

-- SÓ pelo SQL Editor.
revoke execute on function public.preparar_demonstracao(text, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. limpar_demonstracao — desfaz tudo
--
-- Apaga os alunos fictícios e a escola. As cinco contas da equipe
-- continuam existindo, voltam a ser alunos comuns sem escola e saem do
-- mundo de demonstração.
-- ---------------------------------------------------------------------
create or replace function public.limpar_demonstracao()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_escola uuid;
  v_equipe uuid[];
begin
  select dm.escola_id into v_escola from public.demonstracao dm where dm.id = 1;
  select coalesce(array_agg(d.user_id), '{}') into v_equipe from public.contas_demo d where d.da_equipe;

  -- Fictícios: apagar em auth.users leva perfil e dados em cascata.
  delete from auth.users u
   where u.id in (select d.user_id from public.contas_demo d where not d.da_equipe);

  -- O que a equipe fez como demonstração some junto com ela.
  delete from public.agendamentos a where a.psicologo_id = any (v_equipe) or a.aluno_id = any (v_equipe);
  delete from public.mensagens_apoio m where m.psicologo_id = any (v_equipe) or m.participante_id = any (v_equipe);
  delete from public.consentimentos_dados c where c.psicologo_id = any (v_equipe) or c.aluno_id = any (v_equipe);
  delete from public.vinculos_responsavel v where v.responsavel_id = any (v_equipe) or v.aluno_id = any (v_equipe);
  delete from public.telemetria_estudo t where t.user_id = any (v_equipe);
  delete from public.indice_burnout b where b.user_id = any (v_equipe);
  delete from public.psicologos ps where ps.id = any (v_equipe);

  update public.perfis p
     set papel = 'student', escola_id = null, turma_id = null
   where p.id = any (v_equipe);

  delete from public.contas_demo;
  delete from public.demonstracao;
  if v_escola is not null then
    delete from public.escolas e where e.id = v_escola;
  end if;

  return 'Demonstração removida.';
end $$;

revoke execute on function public.limpar_demonstracao() from public, anon, authenticated;

commit;
