-- =====================================================================
-- 024 — Vínculo responsável ↔ aluno POR CÓDIGO, e data de nascimento
-- =====================================================================
--
-- DECISÃO DE PRODUTO (registrada no CLAUDE.md)
-- ---------------------------------------------------------------------
-- Até aqui o responsável digitava o EMAIL do aluno e o aluno aprovava
-- (`solicitar_vinculo`, migration 010). Isso continua existindo, mas o
-- caminho principal passa a ser o inverso: o ALUNO gera um código no
-- Perfil e entrega a quem quiser.
--
-- A diferença não é de ergonomia, é de quem manda: com o email, qualquer
-- pessoa que saiba o endereço do aluno dispara um pedido e o aluno só
-- reage. Com o código, ninguém pede nada — o aluno decide antes, e
-- entregar o código JÁ É o consentimento.
--
-- Por isso o vínculo criado aqui nasce 'ativo', sem segunda confirmação.
-- Pedir aprovação depois de o próprio aluno ter entregado o código seria
-- perguntar duas vezes a mesma coisa.
--
-- O controle continua com o aluno depois do vínculo: ele lista quem o
-- acompanha, revoga quando quiser (`revogar_vinculo`) e pode invalidar o
-- código vazado gerando outro (`regenerar_codigo_vinculo`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. data_nascimento
--
-- Necessária para a regra de consentimento do psicólogo: o aluno
-- autoriza, mas menor de 16 exige o responsável (LGPD, art. 14).
-- Fica NULA para quem já existe; o onboarding passa a perguntar, e a
-- regra trata nulo como "idade desconhecida" — que é o caso
-- conservador, não o permissivo.
-- ---------------------------------------------------------------------
alter table public.perfis
  add column if not exists data_nascimento date;

comment on column public.perfis.data_nascimento is
  'Usada na regra de consentimento (menor de 16 exige responsavel). Nulo = idade desconhecida = trata como menor.';

-- ---------------------------------------------------------------------
-- 2. codigo_vinculo
--
-- 8 caracteres, como o código de instituição da 018 — mesmo formato que
-- a secretaria e os alunos já estão acostumados a ler e digitar.
--
-- Só o dono lê o próprio código: a policy de `perfis` já restringe o
-- select ao próprio id (e a educador/psicólogo dentro do escopo deles),
-- então o código não vira campo público por acidente.
-- ---------------------------------------------------------------------
-- O DEFAULT é obrigatório, não conveniência: sem ele só os perfis que já
-- existiam (o `update` abaixo) teriam código, e TODO CADASTRO NOVO
-- nasceria com `codigo_vinculo` nulo — o aluno abriria o Perfil e não
-- teria nada para entregar ao responsável. O teste de migração pegou
-- isso; em produção só apareceria no primeiro cadastro real.
alter table public.perfis
  add column if not exists codigo_vinculo text unique
  default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

-- Preenche quem já existe. `id` entra no hash para dois perfis criados
-- no mesmo instante não colidirem.
update public.perfis
   set codigo_vinculo = upper(substr(md5(random()::text || id::text), 1, 8))
 where codigo_vinculo is null;

create index if not exists idx_perfis_codigo_vinculo
  on public.perfis (upper(codigo_vinculo));

-- ---------------------------------------------------------------------
-- 3. e_menor_de_16(uuid)
--
-- Função única da regra de idade, para ela não ser reimplementada com
-- critérios diferentes em cada lugar que precisar.
--
-- Sem data de nascimento devolve TRUE: idade desconhecida é tratada como
-- menor. O erro seguro aqui é exigir o responsável de alguém que já
-- podia consentir sozinho; o inverso é liberar dado de saúde mental de
-- um menor sem base legal.
-- ---------------------------------------------------------------------
create or replace function public.e_menor_de_16(p_aluno uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select data_nascimento > (current_date - interval '16 years')
       from public.perfis where id = p_aluno),
    true
  );
$$;

grant execute on function public.e_menor_de_16(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. vincular_por_codigo(p_codigo)
--
-- Chamada pelo RESPONSÁVEL. Cria o vínculo já aceito.
--
-- Trava contra enumeração: a mensagem de erro é a mesma para código
-- inexistente e para código de alguém que não é aluno. Diferenciar
-- permitiria descobrir códigos válidos por tentativa e erro.
-- ---------------------------------------------------------------------
create or replace function public.vincular_por_codigo(
  p_codigo     text,
  p_parentesco text default 'responsavel'
)
returns public.vinculos_responsavel
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := (select auth.uid());
  v_aluno   public.perfis;
  v_vinculo public.vinculos_responsavel;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  -- Só quem é responsável usa este caminho. Sem isto, um aluno com o
  -- código de outro viraria "responsável" dele e leria tudo.
  if not exists (select 1 from public.perfis where id = v_user and papel = 'parent') then
    raise exception 'apenas responsaveis podem usar codigo de vinculo';
  end if;

  select * into v_aluno
    from public.perfis
   where upper(codigo_vinculo) = upper(trim(p_codigo))
     and papel = 'student';

  if not found then
    raise exception 'codigo invalido';
  end if;

  -- O próprio perfil nunca é o aluno vinculado.
  if v_aluno.id = v_user then
    raise exception 'codigo invalido';
  end if;

  -- Reentrante: refazer o vínculo já existente reativa em vez de estourar
  -- no unique. Responsável que revogou por engano só digita o código de
  -- novo.
  insert into public.vinculos_responsavel (responsavel_id, aluno_id, parentesco, status, respondido_em)
  values (v_user, v_aluno.id, coalesce(nullif(trim(p_parentesco), ''), 'responsavel'), 'ativo', now())
  on conflict (responsavel_id, aluno_id) do update
    set status = 'ativo',
        parentesco = excluded.parentesco,
        respondido_em = now()
  returning * into v_vinculo;

  -- O aluno fica sabendo. Vínculo silencioso seria vigilância.
  insert into public.notificacoes (user_id, tipo, titulo, corpo)
  values (
    v_aluno.id,
    'vinculo',
    'Novo responsável acompanhando você',
    coalesce((select nome from public.perfis where id = v_user), 'Um responsável')
      || ' entrou com o seu código e agora acompanha seu progresso. Você pode remover em Perfil.'
  );

  return v_vinculo;
end $$;

grant execute on function public.vincular_por_codigo(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. regenerar_codigo_vinculo()
--
-- O aluno invalida o código entregue a quem não devia. Vínculos já
-- aceitos continuam — trocar o código fecha a porta para novos, não
-- expulsa quem já entrou (para isso existe `revogar_vinculo`).
-- ---------------------------------------------------------------------
create or replace function public.regenerar_codigo_vinculo()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
  v_novo text;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  -- Tenta até achar um código livre. O espaço é 16^8; a colisão é rara,
  -- mas `unique` sem retry viraria erro na cara do aluno.
  for i in 1..5 loop
    v_novo := upper(substr(md5(random()::text || clock_timestamp()::text || v_user::text), 1, 8));
    begin
      update public.perfis set codigo_vinculo = v_novo where id = v_user;
      return v_novo;
    exception when unique_violation then
      null;
    end;
  end loop;

  raise exception 'nao foi possivel gerar um codigo, tente de novo';
end $$;

grant execute on function public.regenerar_codigo_vinculo() to authenticated;

-- ---------------------------------------------------------------------
-- 6. revogar_vinculo(p_vinculo)
--
-- Os DOIS lados podem encerrar: o aluno tira quem não quer mais, e o
-- responsável sai de um vínculo que não lhe cabe. Um menor que precise
-- se afastar de um responsável não deveria depender desse responsável
-- para isso.
-- ---------------------------------------------------------------------
create or replace function public.revogar_vinculo(p_vinculo uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  update public.vinculos_responsavel
     set status = 'revogado', respondido_em = now()
   where id = p_vinculo
     and (aluno_id = v_user or responsavel_id = v_user);

  if not found then
    raise exception 'vinculo nao encontrado';
  end if;
end $$;

grant execute on function public.revogar_vinculo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. meus_responsaveis()
--
-- O aluno vê quem o acompanha. Sem esta lista o código seria uma porta
-- sem olho mágico: dá para abrir, não dá para saber quem entrou.
--
-- Devolve nome e email do responsável — quem já tem acesso aos dados do
-- aluno não é anônimo para ele.
-- ---------------------------------------------------------------------
create or replace function public.meus_responsaveis()
returns table (
  id            uuid,
  responsavel   text,
  email         text,
  parentesco    text,
  status        text,
  desde         timestamptz
)
language sql stable security definer set search_path = public as $$
  select v.id,
         p.nome,
         p.email,
         v.parentesco,
         v.status::text,
         v.respondido_em
    from public.vinculos_responsavel v
    join public.perfis p on p.id = v.responsavel_id
   where v.aluno_id = (select auth.uid())
     and v.status <> 'revogado'
   order by v.respondido_em desc nulls last;
$$;

grant execute on function public.meus_responsaveis() to authenticated;
