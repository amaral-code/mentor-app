-- =====================================================================
-- 027 — Psicólogo: consentimento, prontuário, mensagens e avaliações
-- =====================================================================
--
-- A vitrine, a agenda e o agendamento já existiam (010/011). O que
-- faltava era o que transforma um horário marcado em acompanhamento:
--
--   1. CONSENTIMENTO   quem libera o quê, para qual profissional, até quando
--   2. PRONTUÁRIO      anotação de sessão que só o autor lê
--   3. MENSAGENS       canal entre sessões, cada conversa com duas pontas
--   4. AVALIAÇÕES      a fonte que `psicologos.nota_media` nunca teve
--
-- A REGRA DE CONSENTIMENTO (decisão do dono, registrada no CLAUDE.md)
-- ---------------------------------------------------------------------
-- O aluno autoriza. Menor de 16 exige o responsável (LGPD, art. 14).
-- Quem decide a idade é `e_menor_de_16` (024), e data ausente conta
-- como menor.
--
-- As duas pontas são EXCLUSIVAS, não cumulativas:
--   - menor de 16  -> só o responsável ativo concede;
--   - 16 ou mais   -> só o próprio aluno concede.
-- Um responsável liberando dado de saúde mental de um jovem de 17 anos
-- sem ele saber inverteria a regra que a lei protege.
--
-- Consentimento tem ESCOPO e VALIDADE, e nunca é permanente: teto de
-- 180 dias. Revogar, por outro lado, é aberto a mais gente (o aluno
-- sempre, inclusive o menor; quem concedeu; o próprio profissional),
-- porque revogar só diminui o que é compartilhado. Esse é o sentido
-- seguro, e não pode depender de uma única pessoa.
--
-- ESTE ARQUIVO NÃO É PARECER JURÍDICO. O sigilo técnico está na RLS.
-- A conformidade com a CFP Res. 001/2009 (guarda, prazo, acesso do
-- paciente ao próprio registro) precisa de validação profissional antes
-- de uso com paciente real.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Nota média precisa de contagem
--
-- `nota_media` nasceu com default 5.00. Sem saber quantas avaliações a
-- sustentam, a vitrine mostrava "5 estrelas" para quem nunca foi
-- avaliado, que é justamente o profissional sobre quem ninguém sabe
-- nada. Com a contagem, a tela diz "sem avaliações".
-- ---------------------------------------------------------------------
alter table public.psicologos
  add column if not exists total_avaliacoes integer not null default 0
  check (total_avaliacoes >= 0);

-- ---------------------------------------------------------------------
-- 0b. A faixa de idade deixa de ser pública
--
-- A 024 liberou `e_menor_de_16(uuid)` para qualquer usuário logado, com
-- QUALQUER id: bastava conhecer o id de alguém para saber se a pessoa
-- tem menos de 16 anos. As funções que precisam da regra rodam como
-- SECURITY DEFINER e continuam chamando normalmente; quem perde o
-- acesso é só o cliente.
--
-- A tela recebe a mesma resposta por `quem_autoriza`, que só responde
-- ao próprio aluno e aos responsáveis dele.
-- ---------------------------------------------------------------------
revoke execute on function public.e_menor_de_16(uuid) from public, anon, authenticated;

create or replace function public.quem_autoriza(p_aluno uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if p_aluno <> (select auth.uid()) and not public.sou_responsavel_de(p_aluno) then
    raise exception 'sem_permissao: so o proprio estudante ou o responsavel';
  end if;
  return case when public.e_menor_de_16(p_aluno) then 'responsavel' else 'aluno' end;
end $$;

grant execute on function public.quem_autoriza(uuid) to authenticated;

-- =====================================================================
-- 1. CONSENTIMENTO
-- =====================================================================
create table if not exists public.consentimentos_dados (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references public.perfis(id)     on delete cascade,
  psicologo_id  uuid not null references public.psicologos(id) on delete cascade,
  concedido_por uuid not null references public.perfis(id)     on delete cascade,
  escopo        text[] not null,
  valido_ate    timestamptz not null,
  revogado_em   timestamptz,
  revogado_por  uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  -- Escopo vazio seria consentimento para nada que ainda ocupa a vaga
  -- de "vigente"; escopo fora da lista seria acesso que nenhuma função
  -- sabe honrar.
  constraint consent_escopo_valido check (
    cardinality(escopo) > 0 and escopo <@ array['bem_estar', 'estudo']::text[]
  ),
  constraint consent_validade check (valido_ate > criado_em)
);

create index if not exists consent_aluno_idx on public.consentimentos_dados (aluno_id, psicologo_id);
create index if not exists consent_psico_idx on public.consentimentos_dados (psicologo_id);

-- No máximo UM consentimento em aberto por par. Conceder de novo
-- substitui o anterior (a função revoga antes de inserir); sem este
-- índice, duas abas concedendo ao mesmo tempo deixariam dois vigentes
-- com escopos diferentes, e a pergunta "o que está liberado?" teria
-- duas respostas.
create unique index if not exists consent_um_aberto_por_par
  on public.consentimentos_dados (aluno_id, psicologo_id)
  where revogado_em is null;

alter table public.consentimentos_dados enable row level security;

-- Leitura: as três partes. Escrita: só pelas funções.
drop policy if exists consent_sel on public.consentimentos_dados;
create policy consent_sel on public.consentimentos_dados for select
  using (
    (select auth.uid()) in (aluno_id, psicologo_id, concedido_por)
    or public.sou_responsavel_de(aluno_id)
  );

-- ---------------------------------------------------------------------
-- consentimento_vigente — a pergunta que todas as outras funções fazem
-- ---------------------------------------------------------------------
create or replace function public.consentimento_vigente(
  p_aluno     uuid,
  p_psicologo uuid,
  p_escopo    text default null
)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consentimentos_dados c
     where c.aluno_id = p_aluno
       and c.psicologo_id = p_psicologo
       and c.revogado_em is null
       and c.valido_ate > now()
       and (p_escopo is null or p_escopo = any (c.escopo))
  );
$$;

grant execute on function public.consentimento_vigente(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- conceder_consentimento
-- ---------------------------------------------------------------------
create or replace function public.conceder_consentimento(
  p_aluno     uuid,
  p_psicologo uuid,
  p_escopo    text[],
  p_dias      integer default 90
)
returns public.consentimentos_dados
language plpgsql security definer set search_path = public as $$
declare
  v_quem   uuid := (select auth.uid());
  v_menor  boolean;
  v_dias   integer := least(greatest(coalesce(p_dias, 90), 1), 180);
  v_row    public.consentimentos_dados;
  v_nome_psico text;
begin
  if v_quem is null then
    raise exception 'nao autenticado';
  end if;

  if not exists (select 1 from public.psicologos ps where ps.id = p_psicologo) then
    raise exception 'profissional nao encontrado';
  end if;

  if not exists (
    select 1 from public.perfis p where p.id = p_aluno and p.papel::text = 'student'
  ) then
    raise exception 'estudante nao encontrado';
  end if;

  v_menor := public.e_menor_de_16(p_aluno);

  -- As duas pontas são exclusivas. Ver o cabeçalho do arquivo.
  if v_menor then
    if not public.sou_responsavel_de(p_aluno) then
      raise exception 'menor_de_16: so o responsavel pode autorizar';
    end if;
  else
    if v_quem <> p_aluno then
      raise exception 'maior_de_16: so o proprio estudante pode autorizar';
    end if;
  end if;

  -- Substitui o que estiver em aberto: conceder de novo é mudar escopo
  -- ou renovar, e as duas coisas começam do zero.
  update public.consentimentos_dados c
     set revogado_em = now(), revogado_por = v_quem
   where c.aluno_id = p_aluno
     and c.psicologo_id = p_psicologo
     and c.revogado_em is null;

  insert into public.consentimentos_dados
    (aluno_id, psicologo_id, concedido_por, escopo, valido_ate)
  values
    (p_aluno, p_psicologo, v_quem, p_escopo, now() + make_interval(days => v_dias))
  returning * into v_row;

  -- O aluno SEMPRE fica sabendo, inclusive quando quem concedeu foi o
  -- responsável. Acesso a dado de saúde mental dele não acontece em
  -- silêncio, nem com base legal.
  select pf.nome into v_nome_psico from public.perfis pf where pf.id = p_psicologo;
  insert into public.notificacoes (user_id, tipo, titulo, corpo)
  values (
    p_aluno,
    'consentimento',
    'Acesso liberado a um psicólogo',
    coalesce(v_nome_psico, 'Um profissional')
      || ' pode ver ' || array_to_string(p_escopo, ' e ')
      || ' até ' || to_char(v_row.valido_ate at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
      || '. Você pode encerrar quando quiser, em Perfil.'
  );

  return v_row;
end $$;

grant execute on function public.conceder_consentimento(uuid, uuid, text[], integer) to authenticated;

-- ---------------------------------------------------------------------
-- revogar_consentimento — aberto a quem só pode reduzir o acesso
-- ---------------------------------------------------------------------
create or replace function public.revogar_consentimento(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_quem uuid := (select auth.uid());
begin
  update public.consentimentos_dados c
     set revogado_em = now(), revogado_por = v_quem
   where c.id = p_id
     and c.revogado_em is null
     and (
       v_quem in (c.aluno_id, c.psicologo_id, c.concedido_por)
       or public.sou_responsavel_de(c.aluno_id)
     );

  if not found then
    raise exception 'consentimento nao encontrado';
  end if;
end $$;

grant execute on function public.revogar_consentimento(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- meus_consentimentos — visão do aluno e do responsável
-- ---------------------------------------------------------------------
create or replace function public.meus_consentimentos()
returns table (
  id             uuid,
  aluno_id       uuid,
  aluno_nome     text,
  psicologo_id   uuid,
  psicologo_nome text,
  crp            text,
  escopo         text[],
  valido_ate     timestamptz,
  concedido_por  text,
  vigente        boolean
)
language sql stable security definer set search_path = public as $$
  select c.id,
         c.aluno_id,
         pa.nome,
         c.psicologo_id,
         pp.nome,
         ps.crp,
         c.escopo,
         c.valido_ate,
         pc.nome,
         (c.revogado_em is null and c.valido_ate > now())
    from public.consentimentos_dados c
    join public.perfis pa     on pa.id = c.aluno_id
    join public.perfis pp     on pp.id = c.psicologo_id
    join public.psicologos ps on ps.id = c.psicologo_id
    join public.perfis pc     on pc.id = c.concedido_por
   where c.revogado_em is null
     and (c.aluno_id = (select auth.uid()) or public.sou_responsavel_de(c.aluno_id))
   order by c.valido_ate desc;
$$;

grant execute on function public.meus_consentimentos() to authenticated;

-- ---------------------------------------------------------------------
-- pacientes — visão do psicólogo
--
-- Paciente é quem tem consentimento vigente OU consulta marcada. A
-- consulta sozinha dá nome e horário (já dava, pela 011); o que ela não
-- dá é dado nenhum além disso.
-- ---------------------------------------------------------------------
create or replace function public.pacientes()
returns table (
  aluno_id    uuid,
  nome        text,
  menor_de_16 boolean,
  escopo      text[],
  valido_ate  timestamptz,
  proxima     timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_quem uuid := (select auth.uid());
begin
  if not exists (select 1 from public.psicologos ps where ps.id = v_quem) then
    raise exception 'sem_permissao: so psicologo lista pacientes';
  end if;

  return query
  with base as (
    select a.aluno_id from public.agendamentos a
     where a.psicologo_id = v_quem
       and a.status::text not in ('cancelado')
    union
    select c.aluno_id from public.consentimentos_dados c
     where c.psicologo_id = v_quem
       and c.revogado_em is null
       and c.valido_ate > now()
  )
  select b.aluno_id,
         p.nome,
         public.e_menor_de_16(b.aluno_id),
         (select c.escopo from public.consentimentos_dados c
           where c.aluno_id = b.aluno_id and c.psicologo_id = v_quem
             and c.revogado_em is null and c.valido_ate > now()
           limit 1),
         (select c.valido_ate from public.consentimentos_dados c
           where c.aluno_id = b.aluno_id and c.psicologo_id = v_quem
             and c.revogado_em is null and c.valido_ate > now()
           limit 1),
         (select min(a.inicio) from public.agendamentos a
           where a.aluno_id = b.aluno_id and a.psicologo_id = v_quem
             and a.inicio > now() and a.status::text in ('agendado', 'confirmado'))
    from base b
    join public.perfis p on p.id = b.aluno_id
   order by p.nome;
end $$;

grant execute on function public.pacientes() to authenticated;

-- ---------------------------------------------------------------------
-- bem_estar_paciente — o que o escopo 'bem_estar' libera
-- ---------------------------------------------------------------------
create or replace function public.bem_estar_paciente(p_aluno uuid, p_dias integer default 30)
returns table (data date, score integer, classe text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 30), 1), 90);
begin
  if not public.consentimento_vigente(p_aluno, (select auth.uid()), 'bem_estar') then
    raise exception 'sem_consentimento: bem-estar nao liberado para voce';
  end if;

  return query
    select b.data, b.score, b.classe::text
      from public.indice_burnout b
     where b.user_id = p_aluno
       and b.data >= current_date - v_dias
     order by b.data;
end $$;

grant execute on function public.bem_estar_paciente(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- O escopo 'estudo' reaproveita os resumos da 025
--
-- Em vez de uma cópia das funções de resumo para o psicólogo, a guarda
-- única da 025 passa a aceitar mais um caso. Uma cópia divergiria na
-- primeira correção feita só num dos lados.
-- ---------------------------------------------------------------------
create or replace function public.pode_ver_resumo(p_aluno uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_aluno = (select auth.uid())
      or public.sou_responsavel_de(p_aluno)
      or public.consentimento_vigente(p_aluno, (select auth.uid()), 'estudo');
$$;

-- =====================================================================
-- 2. PRONTUÁRIO
-- =====================================================================
--
-- SÓ O AUTOR LÊ. Nem o aluno, nem o responsável, nem a secretaria, nem
-- outro psicólogo que venha a atender o mesmo aluno.
--
-- APENAS ACRÉSCIMO. Não há policy de update nem de delete: anotação de
-- sessão errada se corrige com uma nova, do tipo 'retificacao', que
-- aponta para a original. Registro clínico que pode ser reescrito sem
-- rastro não serve de registro.
--
-- A LEITURA NÃO DEPENDE DO CONSENTIMENTO. Se dependesse, revogar o
-- acesso apagaria da vista do profissional o que ele mesmo escreveu, e
-- a guarda do registro é obrigação dele. O que o consentimento controla
-- é ESCREVER sobre alguém: nota nova exige vínculo vigente.
-- ---------------------------------------------------------------------
create table if not exists public.prontuario_notas (
  id              uuid primary key default gen_random_uuid(),
  psicologo_id    uuid not null references public.psicologos(id) on delete cascade,
  aluno_id        uuid not null references public.perfis(id)     on delete cascade,
  agendamento_id  uuid references public.agendamentos(id) on delete set null,
  tipo            text not null default 'evolucao' check (tipo in ('evolucao', 'retificacao')),
  retifica_id     uuid references public.prontuario_notas(id) on delete restrict,
  texto           text not null check (char_length(trim(texto)) between 1 and 20000),
  criado_em       timestamptz not null default now(),
  constraint retificacao_aponta check (
    (tipo = 'retificacao' and retifica_id is not null)
    or (tipo = 'evolucao' and retifica_id is null)
  )
);

create index if not exists prontuario_idx
  on public.prontuario_notas (psicologo_id, aluno_id, criado_em desc);

alter table public.prontuario_notas enable row level security;

create or replace function public.atende_paciente(p_aluno uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.psicologos ps where ps.id = (select auth.uid()))
     and (
       public.consentimento_vigente(p_aluno, (select auth.uid()))
       or exists (
         select 1 from public.agendamentos a
          where a.aluno_id = p_aluno
            and a.psicologo_id = (select auth.uid())
            and a.status::text not in ('cancelado')
       )
     );
$$;

grant execute on function public.atende_paciente(uuid) to authenticated;

drop policy if exists prontuario_sel on public.prontuario_notas;
create policy prontuario_sel on public.prontuario_notas for select
  using (psicologo_id = (select auth.uid()));

-- Retificação só de nota própria e do mesmo paciente.
--
-- Em função SECURITY DEFINER, e não num `exists` dentro da policy: a
-- policy de insert consultando a própria tabela dispara a policy de
-- select dela, que o Postgres recusa como recursão infinita. É o mesmo
-- defeito que a 004 corrigiu nas ligas; o teste de migração pegou antes
-- de chegar ao SQL Editor.
create or replace function public.nota_propria_do_paciente(p_nota uuid, p_aluno uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.prontuario_notas o
     where o.id = p_nota
       and o.psicologo_id = (select auth.uid())
       and o.aluno_id = p_aluno
  );
$$;

drop policy if exists prontuario_ins on public.prontuario_notas;
create policy prontuario_ins on public.prontuario_notas for insert
  with check (
    psicologo_id = (select auth.uid())
    and public.atende_paciente(aluno_id)
    and (retifica_id is null or public.nota_propria_do_paciente(retifica_id, aluno_id))
  );

-- Sem policy de update e de delete: a ausência É a regra.

-- =====================================================================
-- 3. MENSAGENS
-- =====================================================================
--
-- CADA CONVERSA TEM DUAS PONTAS. O canal psicólogo/aluno e o canal
-- psicólogo/responsável são conversas SEPARADAS. Se o responsável
-- lesse o que o filho escreve ao psicólogo, o sigilo da terapia do
-- adolescente acabaria na primeira mensagem, e com ele a razão de o
-- adolescente escrever.
-- ---------------------------------------------------------------------
create table if not exists public.mensagens_apoio (
  id              uuid primary key default gen_random_uuid(),
  psicologo_id    uuid not null references public.psicologos(id) on delete cascade,
  participante_id uuid not null references public.perfis(id)     on delete cascade,
  autor_id        uuid not null references public.perfis(id)     on delete cascade,
  texto           text not null check (char_length(trim(texto)) between 1 and 4000),
  criado_em       timestamptz not null default now(),
  lida_em         timestamptz,
  constraint autor_e_uma_das_pontas check (autor_id in (psicologo_id, participante_id))
);

create index if not exists mensagens_conversa_idx
  on public.mensagens_apoio (psicologo_id, participante_id, criado_em);

alter table public.mensagens_apoio enable row level security;

drop policy if exists mensagens_sel on public.mensagens_apoio;
create policy mensagens_sel on public.mensagens_apoio for select
  using ((select auth.uid()) in (psicologo_id, participante_id));

-- Escrita só pelas funções: a checagem de vínculo não cabe numa policy
-- sem virar uma consulta cara a cada linha lida.

-- Quem pode conversar: psicólogo com o aluno que atende, ou com o
-- responsável que marcou a consulta / concedeu o consentimento.
create or replace function public.pode_conversar(p_psicologo uuid, p_participante uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agendamentos a
     where a.psicologo_id = p_psicologo
       and (a.aluno_id = p_participante or a.responsavel_id = p_participante)
       and a.status::text not in ('cancelado')
  ) or exists (
    select 1 from public.consentimentos_dados c
     where c.psicologo_id = p_psicologo
       and (c.aluno_id = p_participante or c.concedido_por = p_participante)
       and c.revogado_em is null
       and c.valido_ate > now()
  );
$$;

create or replace function public.enviar_mensagem_apoio(
  p_psicologo    uuid,
  p_participante uuid,
  p_texto        text
)
returns public.mensagens_apoio
language plpgsql security definer set search_path = public as $$
declare
  v_quem uuid := (select auth.uid());
  v_row  public.mensagens_apoio;
  v_dest uuid;
begin
  if v_quem is null or v_quem not in (p_psicologo, p_participante) then
    raise exception 'sem_permissao: voce nao faz parte desta conversa';
  end if;

  if not public.pode_conversar(p_psicologo, p_participante) then
    raise exception 'sem_vinculo: nao ha consulta nem consentimento entre voces';
  end if;

  insert into public.mensagens_apoio (psicologo_id, participante_id, autor_id, texto)
  values (p_psicologo, p_participante, v_quem, trim(p_texto))
  returning * into v_row;

  -- A notificação diz QUE chegou mensagem, nunca o texto: notificação
  -- aparece na tela bloqueada do celular, na frente de quem estiver
  -- perto.
  v_dest := case when v_quem = p_psicologo then p_participante else p_psicologo end;
  insert into public.notificacoes (user_id, tipo, titulo, corpo)
  values (v_dest, 'mensagem_apoio', 'Nova mensagem', 'Você tem uma mensagem nova no app.');

  return v_row;
end $$;

grant execute on function public.enviar_mensagem_apoio(uuid, uuid, text) to authenticated;

create or replace function public.marcar_conversa_lida(p_psicologo uuid, p_participante uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_quem uuid := (select auth.uid());
begin
  if v_quem is null or v_quem not in (p_psicologo, p_participante) then
    raise exception 'sem_permissao: voce nao faz parte desta conversa';
  end if;

  update public.mensagens_apoio m
     set lida_em = now()
   where m.psicologo_id = p_psicologo
     and m.participante_id = p_participante
     and m.autor_id <> v_quem
     and m.lida_em is null;
end $$;

grant execute on function public.marcar_conversa_lida(uuid, uuid) to authenticated;

create or replace function public.minhas_conversas()
returns table (
  psicologo_id    uuid,
  participante_id uuid,
  outro_nome      text,
  ultima_texto    text,
  ultima_em       timestamptz,
  nao_lidas       integer,
  ativa           boolean
)
language sql stable security definer set search_path = public as $$
  with minhas as (
    select distinct m.psicologo_id, m.participante_id
      from public.mensagens_apoio m
     where (select auth.uid()) in (m.psicologo_id, m.participante_id)
  )
  select c.psicologo_id,
         c.participante_id,
         (select p.nome from public.perfis p
           where p.id = case when (select auth.uid()) = c.psicologo_id
                             then c.participante_id else c.psicologo_id end),
         u.texto,
         u.criado_em,
         (select count(*)::integer from public.mensagens_apoio m
           where m.psicologo_id = c.psicologo_id
             and m.participante_id = c.participante_id
             and m.autor_id <> (select auth.uid())
             and m.lida_em is null),
         public.pode_conversar(c.psicologo_id, c.participante_id)
    from minhas c
    cross join lateral (
      select m.texto, m.criado_em from public.mensagens_apoio m
       where m.psicologo_id = c.psicologo_id and m.participante_id = c.participante_id
       order by m.criado_em desc limit 1
    ) u
   order by u.criado_em desc;
$$;

grant execute on function public.minhas_conversas() to authenticated;

-- =====================================================================
-- 4. AVALIAÇÕES
-- =====================================================================
--
-- Uma por consulta, de quem participou dela, depois que ela aconteceu.
-- O comentário vai para o profissional SEM o autor: um adolescente não
-- avalia com sinceridade quem vai saber que foi ele.
-- ---------------------------------------------------------------------
create table if not exists public.avaliacoes_psicologo (
  id              uuid primary key default gen_random_uuid(),
  agendamento_id  uuid not null unique references public.agendamentos(id) on delete cascade,
  psicologo_id    uuid not null references public.psicologos(id) on delete cascade,
  autor_id        uuid not null references public.perfis(id)     on delete cascade,
  nota            smallint not null check (nota between 1 and 5),
  comentario      text check (comentario is null or char_length(comentario) <= 1000),
  criado_em       timestamptz not null default now()
);

alter table public.avaliacoes_psicologo enable row level security;

-- Só o autor lê a linha crua (é onde o autor_id está).
drop policy if exists avaliacoes_sel on public.avaliacoes_psicologo;
create policy avaliacoes_sel on public.avaliacoes_psicologo for select
  using (autor_id = (select auth.uid()));

create or replace function public.avaliar_consulta(
  p_agendamento uuid,
  p_nota        integer,
  p_comentario  text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_quem uuid := (select auth.uid());
  v_ag   public.agendamentos;
begin
  select * into v_ag from public.agendamentos a where a.id = p_agendamento;
  if v_ag.id is null then
    raise exception 'consulta nao encontrada';
  end if;

  if v_quem is null or v_quem not in (v_ag.aluno_id, coalesce(v_ag.responsavel_id, v_ag.aluno_id)) then
    raise exception 'sem_permissao: so quem participou da consulta avalia';
  end if;

  -- Avaliar antes de a consulta acontecer seria avaliar a vitrine, e
  -- consulta cancelada ou de falta não diz nada sobre o profissional.
  if v_ag.fim > now() then
    raise exception 'a consulta ainda nao aconteceu';
  end if;
  if v_ag.status::text in ('cancelado', 'no_show') then
    raise exception 'consulta cancelada ou sem comparecimento nao pode ser avaliada';
  end if;

  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'a nota vai de 1 a 5';
  end if;

  insert into public.avaliacoes_psicologo (agendamento_id, psicologo_id, autor_id, nota, comentario)
  values (p_agendamento, v_ag.psicologo_id, v_quem, p_nota, nullif(trim(p_comentario), ''));

  -- Recalcula pela tabela inteira, e não incrementando: um incremento
  -- que falhasse uma vez deixaria a média errada para sempre.
  update public.psicologos ps
     set nota_media = coalesce((
           select round(avg(av.nota)::numeric, 2)
             from public.avaliacoes_psicologo av where av.psicologo_id = ps.id), 5.00),
         total_avaliacoes = (
           select count(*) from public.avaliacoes_psicologo av where av.psicologo_id = ps.id)
   where ps.id = v_ag.psicologo_id;
exception
  when unique_violation then
    raise exception 'esta consulta ja foi avaliada';
end $$;

grant execute on function public.avaliar_consulta(uuid, integer, text) to authenticated;

-- Quais consultas o usuário já avaliou, para a tela não oferecer de novo.
create or replace function public.consultas_avaliadas()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select av.agendamento_id from public.avaliacoes_psicologo av
   where av.autor_id = (select auth.uid());
$$;

grant execute on function public.consultas_avaliadas() to authenticated;

-- O que o profissional vê das avaliações: nota, comentário e data. Nunca
-- quem escreveu.
create or replace function public.avaliacoes_recebidas()
returns table (nota smallint, comentario text, criado_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.psicologos ps where ps.id = (select auth.uid())) then
    raise exception 'sem_permissao: so o proprio profissional le suas avaliacoes';
  end if;

  return query
    select av.nota, av.comentario, av.criado_em
      from public.avaliacoes_psicologo av
     where av.psicologo_id = (select auth.uid())
     order by av.criado_em desc;
end $$;

grant execute on function public.avaliacoes_recebidas() to authenticated;

-- A vitrine ganha a contagem, no fim da lista de colunas: `create or
-- replace view` só aceita coluna nova acrescentada ao final.
create or replace view public.catalogo_psicologos as
  select ps.id, p.nome, p.avatar_url,
         ps.crp, ps.bio, ps.especialidades, ps.abordagem,
         ps.valor_centavos, ps.duracao_minutos, ps.foto_url,
         ps.aceita_novos, ps.atende_adolescente, ps.nota_media,
         ps.total_atendimentos, ps.fuso, ps.total_avaliacoes
    from public.psicologos ps
    join public.perfis p on p.id = ps.id
   where p.papel::text = 'psychologist';

grant select on public.catalogo_psicologos to authenticated;

commit;
