-- =====================================================================
-- Ampli-IA - migrations pendentes (005 a 009)
--
-- Verificado por API em 13/08: o banco tem 003 e 004. As cinco abaixo
-- NAO estao aplicadas, mesmo que o SQL Editor tenha sido aberto antes.
-- Se nada acontecer ao rodar, confira se a aba esta no projeto
-- SEU_PROJETO e se o resultado foi "Success".
--
-- Cada bloco abre e fecha a propria transacao: se um falhar, os
-- anteriores permanecem e o erro aponta o bloco exato.
-- =====================================================================



-- #####################################################################
-- LOJA: catalogo no banco e compra validada no servidor
-- fonte: supabase/migrations/005_loja_compra_servidor.sql
-- #####################################################################

-- =====================================================================
-- Loja: preco no banco e compra validada no servidor
--
-- Por que isto e necessario:
--   registrar_xp() so SOMA (clampa negativos em zero), entao a loja, que
--   DEDUZ XP, nao podia passar por ela. E deixar o cliente mandar o custo
--   seria pior ainda: bastaria enviar custo=0 para levar tudo de graca.
--
--   Com o catalogo no banco, o servidor le o preco, confere o saldo e
--   debita - o cliente so diz QUAL item quer.
--
-- Rode no SQL Editor. Idempotente.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Catalogo (espelha src/shared/lib/storeCatalog.ts)
-- ---------------------------------------------------------------------
create table if not exists public.loja_itens (
  id          text primary key,
  nome        text not null,
  preco       integer not null check (preco >= 0),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

insert into public.loja_itens (id, nome, preco) values
  ('moletom', 'Moletom Midnight',     500),
  ('oculos',  'Oculos de Cientista',  300),
  ('fones',   'Fones de Foco',        400)
on conflict (id) do update
  set nome = excluded.nome, preco = excluded.preco;

alter table public.loja_itens enable row level security;

drop policy if exists loja_itens_sel on public.loja_itens;
create policy loja_itens_sel on public.loja_itens
  for select to authenticated using (ativo);

-- Catalogo e so leitura para o app: preco nao se negocia pelo cliente.
revoke insert, update, delete on public.loja_itens from authenticated;

-- ---------------------------------------------------------------------
-- Compra atomica
--
-- Tudo numa transacao: se qualquer passo falhar, nada acontece. Sem isso
-- daria para receber o item e nao pagar (ou pagar e nao receber) numa
-- falha no meio do caminho.
-- ---------------------------------------------------------------------
create or replace function public.comprar_item(p_item_id text)
returns public.gamificacao
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := (select auth.uid());
  v_preco integer;
  v_nome  text;
  v_xp    integer;
  v_row   public.gamificacao;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  -- preco vem do BANCO, nunca do cliente
  select preco, nome into v_preco, v_nome
    from public.loja_itens where id = p_item_id and ativo;
  if not found then
    raise exception 'item inexistente ou inativo: %', p_item_id;
  end if;

  if exists (select 1 from public.inventario
              where user_id = v_user and item_id = p_item_id) then
    raise exception 'item ja adquirido';
  end if;

  -- trava a linha ate o fim da transacao: sem isso, duas compras
  -- simultaneas leriam o mesmo saldo e passariam as duas
  select xp into v_xp from public.gamificacao
   where user_id = v_user for update;

  if v_xp is null then
    raise exception 'gamificacao nao encontrada';
  end if;
  if v_xp < v_preco then
    raise exception 'saldo insuficiente: tem % XP, precisa de %', v_xp, v_preco;
  end if;

  update public.gamificacao
     set xp = xp - v_preco, atualizado_em = now()
   where user_id = v_user
   returning * into v_row;

  insert into public.inventario (user_id, item_id) values (v_user, p_item_id);

  insert into public.logs (user_id, tipo, descricao, xp)
  values (v_user, 'atividade',
          format('Comprou %s na Loja do Sagui (-%s XP)', v_nome, v_preco),
          -v_preco);

  return v_row;
end $$;

grant execute on function public.comprar_item(text) to authenticated;

-- ---------------------------------------------------------------------
-- Equipar: um acessorio por vez, resolvido no servidor
-- ---------------------------------------------------------------------
create or replace function public.equipar_item(p_item_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.inventario
                  where user_id = v_user and item_id = p_item_id) then
    raise exception 'item nao adquirido';
  end if;
  update public.inventario set equipado = (item_id = p_item_id)
   where user_id = v_user;
end $$;

grant execute on function public.equipar_item(text) to authenticated;

commit;

-- =====================================================================
-- Verificacao:
--   select * from public.loja_itens;             -- 3 itens
--   select public.comprar_item('oculos');        -- erra se faltar saldo
-- =====================================================================


-- #####################################################################
-- LIGAS E MURAL DA TURMA
-- fonte: supabase/migrations/006_ligas_e_comunidade.sql
-- #####################################################################

-- =====================================================================
-- Ligas de estudo e mural da comunidade
--
-- O modelo de liga do app (StudyLeague) tem metas, mensagens, disciplina,
-- codigo de convite e listas de participantes. Normalizar isso em cinco
-- tabelas seria trabalho grande para um formato que ainda muda; guardar o
-- payload em jsonb preserva o modelo exato e mantem em coluna propria
-- apenas o que precisa de indice, chave estrangeira ou policy.
--
-- Rode no SQL Editor. Idempotente.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Ligas
-- ---------------------------------------------------------------------
alter table public.ligas add column if not exists dados      jsonb not null default '{}';
alter table public.ligas add column if not exists disciplina text;
alter table public.ligas add column if not exists xp_premio  integer not null default 0;
alter table public.ligas add column if not exists privada    boolean not null default false;

-- Progresso de cada membro nas metas da liga.
alter table public.liga_membros add column if not exists progresso jsonb not null default '{}';

-- Liga privada so aparece para quem tem o codigo; a publica, para a escola
-- toda. A policy anterior so mostrava as proprias, o que deixava o mural
-- de ligas vazio para todo mundo.
drop policy if exists ligas_sel on public.ligas;
create policy ligas_sel on public.ligas for select using (
  criador_id = (select auth.uid())
  or public.sou_membro_liga(id)
  or (not privada and exists (
        select 1 from public.perfis p
         where p.id = ligas.criador_id
           and p.escola_id is not distinct from public.minha_escola_id()
      ))
);

-- ---------------------------------------------------------------------
-- Mural da turma
--
-- O app agrupa as mensagens por turma. escola_id fica desnormalizado na
-- linha para a policy nao precisar de join a cada leitura.
--
-- Nota: o codigo do front apontava para uma tabela `community_messages`
-- que nunca existiu neste banco (heranca do 001_schema.sql). O nome certo
-- e mensagens_comunidade; estas colunas completam o modelo que a tela usa.
-- ---------------------------------------------------------------------
alter table public.mensagens_comunidade add column if not exists materia     text;
alter table public.mensagens_comunidade add column if not exists moderada    boolean not null default true;
alter table public.mensagens_comunidade add column if not exists motivo_mod  text;
alter table public.mensagens_comunidade add column if not exists responde_a  bigint references public.mensagens_comunidade(id) on delete set null;
alter table public.mensagens_comunidade add column if not exists curtido_por uuid[] not null default '{}';

-- Curtir e a unica alteracao que um terceiro pode fazer na mensagem.
-- Sem policy de UPDATE ninguem curte; com uma policy aberta, qualquer um
-- reescreveria o texto alheio. Por isso o UPDATE exige que o conteudo
-- permaneca igual.
drop policy if exists mensagens_upd_curtida on public.mensagens_comunidade;
create policy mensagens_upd_curtida on public.mensagens_comunidade
  for update
  using (turma_id = public.minha_turma_id())
  with check (turma_id = public.minha_turma_id());

create or replace function public.trava_texto_mensagem()
returns trigger
language plpgsql as $$
begin
  if new.conteudo is distinct from old.conteudo
     or new.autor_id is distinct from old.autor_id then
    raise exception 'so a curtida pode ser alterada';
  end if;
  return new;
end $$;

drop trigger if exists mensagens_trava_texto on public.mensagens_comunidade;
create trigger mensagens_trava_texto
  before update on public.mensagens_comunidade
  for each row execute function public.trava_texto_mensagem();

create or replace function public.preencher_escola_mensagem()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.escola_id is null then
    select escola_id into new.escola_id from public.perfis where id = new.autor_id;
  end if;
  return new;
end $$;

drop trigger if exists mensagens_preenche_escola on public.mensagens_comunidade;
create trigger mensagens_preenche_escola
  before insert on public.mensagens_comunidade
  for each row execute function public.preencher_escola_mensagem();

commit;

-- =====================================================================
-- Verificacao:
--   select column_name from information_schema.columns
--    where table_name = 'ligas' order by ordinal_position;
-- =====================================================================


-- #####################################################################
-- ENTRADA EM TURMA POR CODIGO DO PROFESSOR
-- fonte: supabase/migrations/007_entrada_por_codigo.sql
-- #####################################################################

-- =====================================================================
-- Entrada em turma por codigo
--
-- Problema que isto resolve:
--   escola_id e turma_id definem o que o aluno enxerga (ranking da escola,
--   mural da turma). Se o proprio aluno pudesse gravar esses campos, ele
--   escolheria qualquer escola e leria o mural de estudantes que nao
--   conhece. Por isso o trigger trava_campos_perfil() os bloqueia.
--
--   Mas travar sem alternativa deixa o aluno sem forma de entrar na turma
--   dele. A saida e a mesma do Google Classroom: o professor passa um
--   codigo, o aluno digita, e o SERVIDOR faz a associacao.
--
-- Rode no SQL Editor. Idempotente.
-- =====================================================================

begin;

-- Codigo curto e legivel, unico por turma.
alter table public.turmas
  add column if not exists codigo text unique
  default upper(substr(md5(random()::text), 1, 6));

update public.turmas
   set codigo = upper(substr(md5(random()::text), 1, 6))
 where codigo is null;

-- ---------------------------------------------------------------------
-- Trava de perfil, agora com uma porta controlada
--
-- O trigger continua bloqueando papel/escola/turma vindos do app. A
-- excecao e uma flag TRANSACIONAL que so entrar_na_turma() liga. Como o
-- PostgREST nao executa SQL arbitrario, o cliente nao tem como acender
-- essa flag por conta propria.
--
-- Evitei session_replication_role: desligar triggers exige superusuario,
-- que o papel do Supabase nao tem.
-- ---------------------------------------------------------------------
create or replace function public.trava_campos_perfil()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is not null
     and coalesce(current_setting('app.matricula_em_curso', true), '') <> 'on' then
    if new.papel is distinct from old.papel then
      raise exception 'papel do usuario nao pode ser alterado pelo app';
    end if;
    if new.escola_id is distinct from old.escola_id
       or new.turma_id is distinct from old.turma_id then
      raise exception 'entre na turma pelo codigo fornecido pelo professor';
    end if;
    if new.id is distinct from old.id then
      raise exception 'id do perfil e imutavel';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- entrar_na_turma()
-- ---------------------------------------------------------------------
create or replace function public.entrar_na_turma(p_codigo text)
returns public.perfis
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_turma  public.turmas;
  v_perfil public.perfis;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  select * into v_turma from public.turmas
   where upper(codigo) = upper(trim(p_codigo));
  if not found then
    raise exception 'codigo invalido';
  end if;

  -- vale so ate o fim desta transacao
  perform set_config('app.matricula_em_curso', 'on', true);

  update public.perfis
     set escola_id = v_turma.escola_id,
         turma_id  = v_turma.id
   where id = v_user
   returning * into v_perfil;

  perform set_config('app.matricula_em_curso', 'off', true);

  if v_perfil.id is null then
    raise exception 'perfil nao encontrado';
  end if;
  return v_perfil;
end $$;

grant execute on function public.entrar_na_turma(text) to authenticated;

-- ---------------------------------------------------------------------
-- Criacao de escola/turma continua fora do alcance do app.
-- Para cadastrar, rode no SQL Editor:
--
--   insert into public.escolas (nome, cidade) values ('Escola X', 'Recife')
--     returning id;
--   insert into public.turmas (escola_id, nome, ano)
--     values ('<id-da-escola>', '3A', '2026') returning id, codigo;
--
-- O 'codigo' devolvido e o que o professor passa para os alunos.
-- ---------------------------------------------------------------------

commit;

-- =====================================================================
-- Verificacao:
--   select id, nome, codigo from public.turmas;
--   select public.entrar_na_turma('ABC123');
-- =====================================================================


-- #####################################################################
-- CORRECAO: formula de nivel divergente cliente/servidor
-- fonte: supabase/migrations/008_corrige_nivel.sql
-- #####################################################################

-- =====================================================================
-- Correcao: formula de nivel divergente entre cliente e servidor
--
-- BUG (introduzido por mim no 003):
--   cliente  src/shared/lib/utils.ts -> calcLevel()
--     custo PROGRESSIVO: nivel 2 custa 100, nivel 3 custa +200,
--     nivel 4 custa +300. Acumulado para alcancar o nivel L = 50*L*(L-1).
--
--   servidor registrar_xp() no 003
--     custo FIXO: level = xp/100 + 1.
--
--   Com 550 XP o servidor dizia nivel 6 e a barra lateral, nivel 3.
--   Pior: o LevelUpOverlay dispara pelo valor do SERVIDOR, entao o aluno
--   via "subiu para o nivel 6" com a interface mostrando 3.
--
--   A formula progressiva e a do desenho original do jogo e esta espalhada
--   pela interface (sidebar, top bar, loja). Quem estava errado era o
--   servidor.
--
-- Rode no SQL Editor. Nao apaga dado: recalcula o nivel de quem ja existe.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Espelha calcLevel() do cliente, laco por laco.
--
-- Usei laco em vez da forma fechada
--   floor((1 + sqrt(1 + 0.08*xp)) / 2)
-- porque nas fronteiras exatas (xp = 100, 300, 600) o arredondamento de
-- ponto flutuante pode cair para o nivel de baixo. Aqui a aritmetica e
-- inteira e o resultado e identico ao do cliente por construcao.
-- ---------------------------------------------------------------------
create or replace function public.nivel_por_xp(p_xp integer)
returns integer
language plpgsql immutable as $$
declare
  v_nivel integer := 1;
  v_resto integer := greatest(0, coalesce(p_xp, 0));
begin
  while v_resto >= 100 * v_nivel loop
    v_resto := v_resto - 100 * v_nivel;
    v_nivel := v_nivel + 1;
  end loop;
  return v_nivel;
end $$;

-- ---------------------------------------------------------------------
-- registrar_xp() passa a usar a funcao acima
-- ---------------------------------------------------------------------
create or replace function public.registrar_xp(
  p_tipo public.log_tipo,
  p_descricao text,
  p_xp integer default 0
)
returns public.gamificacao
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := (select auth.uid());
  v_xp   integer := greatest(0, least(coalesce(p_xp, 0), 500));  -- teto por evento
  v_hoje date := (now() at time zone 'utc')::date;
  v_row  public.gamificacao;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  insert into public.logs (user_id, tipo, descricao, xp)
  values (v_user, p_tipo, left(coalesce(p_descricao, ''), 500), v_xp);

  insert into public.gamificacao (user_id) values (v_user)
    on conflict (user_id) do nothing;

  update public.gamificacao g
     set xp     = g.xp + v_xp,
         level  = public.nivel_por_xp(g.xp + v_xp),
         streak = case
                    when g.ultimo_acesso = v_hoje then g.streak
                    when g.ultimo_acesso = v_hoje - 1 then g.streak + 1
                    else 1
                  end,
         ultimo_acesso = v_hoje,
         atualizado_em = now()
   where g.user_id = v_user
   returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Conserta quem ja tem nivel gravado errado
-- ---------------------------------------------------------------------
update public.gamificacao
   set level = public.nivel_por_xp(xp)
 where level is distinct from public.nivel_por_xp(xp);

commit;

-- =====================================================================
-- Verificacao: as duas colunas devem bater em todas as linhas.
--   select xp, level, public.nivel_por_xp(xp) as esperado
--     from public.gamificacao
--    where level <> public.nivel_por_xp(xp);
--
-- Conferencia rapida da tabela de niveis:
--   select x, public.nivel_por_xp(x)
--     from unnest(array[0,99,100,299,300,599,600,1000]) as x;
--   esperado: 1, 1, 2, 2, 3, 3, 4, 4
-- =====================================================================


-- #####################################################################
-- CORRECAO: XP infinito marcando/desmarcando tarefa
-- fonte: supabase/migrations/009_tarefa_idempotente.sql
-- #####################################################################

-- =====================================================================
-- Correcao: XP infinito marcando e desmarcando tarefa do Plano do Dia
--
-- COMO ERA EXPLORADO
--   O aluno marcava e desmarcava o mesmo item, e cada ciclo creditava
--   20 XP. Em um minuto da para chegar a qualquer nivel, o que esvazia o
--   ranking, as ligas e a loja de uma vez.
--
-- DUAS FALHAS SOMADAS
--   1. No cliente, completeTask lia o estado DEPOIS de inverter o
--      checkbox, entao a condicao premiava a transicao errada.
--   2. No servidor, nada registrava que aquela tarefa ja tinha pago.
--      registrar_xp aceita qualquer chamada, quantas vezes vierem.
--
--   Corrigir so o item 1 nao resolve: bastaria chamar registrar_xp pelo
--   console. A idempotencia precisa morar no banco.
--
-- DECISAO DE PRODUTO
--   Tarefa concluida nao volta atras. E o padrao de meta diaria (Duolingo
--   faz assim) e elimina a classe inteira do problema, em vez de tentar
--   equilibrar credito e estorno. O checkbox fica desabilitado depois de
--   marcado.
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

create or replace function public.concluir_tarefa(p_data date, p_task_id text)
returns public.gamificacao
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := (select auth.uid());
  v_tarefas jsonb;
  v_idx     integer;
  v_ja      boolean;
  v_titulo  text;
  v_row     public.gamificacao;
  v_xp      constant integer := 20;   -- espelha XP_PER_TASK no cliente
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  -- FOR UPDATE trava a linha ate o fim da transacao. Sem isso, dois
  -- cliques quase simultaneos leriam ambos "ainda nao concluida" e
  -- pagariam duas vezes: e o mesmo padrao usado em comprar_item.
  select tarefas into v_tarefas
    from public.planos_diarios
   where user_id = v_user and data = p_data
     for update;

  if v_tarefas is null then
    raise exception 'plano do dia nao encontrado';
  end if;

  select (ord - 1), coalesce((elem ->> 'completed')::boolean, false), elem ->> 'titulo'
    into v_idx, v_ja, v_titulo
    from jsonb_array_elements(v_tarefas) with ordinality as t(elem, ord)
   where elem ->> 'id' = p_task_id;

  if v_idx is null then
    raise exception 'tarefa nao encontrada no plano de hoje';
  end if;

  -- Marca sempre; a operacao e idempotente por natureza.
  update public.planos_diarios
     set tarefas = jsonb_set(tarefas, array[v_idx::text, 'completed'], 'true'::jsonb)
   where user_id = v_user and data = p_data;

  -- Ja tinha pago: devolve o estado atual sem creditar de novo.
  if v_ja then
    select * into v_row from public.gamificacao where user_id = v_user;
    return v_row;
  end if;

  return public.registrar_xp(
    'atividade',
    'Concluiu: ' || coalesce(nullif(v_titulo, ''), 'tarefa do dia'),
    v_xp
  );
end $$;

grant execute on function public.concluir_tarefa(date, text) to authenticated;

commit;

-- =====================================================================
-- Verificacao: chamar duas vezes a mesma tarefa deve creditar UMA vez.
--
--   select xp from public.gamificacao where user_id = auth.uid();
--   select public.concluir_tarefa(current_date, '<id-da-tarefa>');
--   select public.concluir_tarefa(current_date, '<id-da-tarefa>');
--   select xp from public.gamificacao where user_id = auth.uid();
--   -- diferenca esperada: exatamente 20
-- =====================================================================
