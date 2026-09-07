-- =====================================================================
-- Ampli-IA - CONVERSAS DO CHAT (threads na lateral)
--
-- Cada conversa e uma linha em conversas_chat; as mensagens ganham
-- conversa_id (nullable). Nulo = fluxo legado de antes das threads:
-- nada antigo e movido nem perdido, e o app continua abrindo nele
-- quando a conta ainda nao tem conversa nenhuma.
--
-- Apagar a conversa apaga as mensagens juntas (cascade). O titulo nasce
-- "Nova conversa" e o app o troca pela primeira mensagem do aluno.
--
-- Idempotente. Rode depois da 015.
-- =====================================================================

begin;

create table if not exists public.conversas_chat (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.perfis(id) on delete cascade,
  titulo      text not null default 'Nova conversa',
  modo        text not null default 'enem_geral',
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists conversas_user_idx
  on public.conversas_chat (user_id, atualizado_em desc);

-- Amarra opcional: mensagens antigas (conversa_id null) seguem validas.
alter table public.chat_mensagens
  add column if not exists conversa_id uuid references public.conversas_chat(id) on delete cascade;

create index if not exists chat_conversa_idx
  on public.chat_mensagens (user_id, conversa_id, criado_em);

alter table public.conversas_chat enable row level security;

-- Dono total da propria lista. As mensagens seguem com as policies que
-- ja tem (dono via user_id); o vinculo conversa_id nao muda isso.
drop policy if exists conversas_sel on public.conversas_chat;
create policy conversas_sel on public.conversas_chat for select
  using ((select auth.uid()) = user_id);

drop policy if exists conversas_ins on public.conversas_chat;
create policy conversas_ins on public.conversas_chat for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists conversas_upd on public.conversas_chat;
create policy conversas_upd on public.conversas_chat for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists conversas_del on public.conversas_chat;
create policy conversas_del on public.conversas_chat for delete
  using ((select auth.uid()) = user_id);

comment on table public.conversas_chat is 'Threads do Mentor: historico lateral com nova/apagar por conta.';
comment on column public.chat_mensagens.conversa_id is 'Thread dona; null = fluxo legado anterior as conversas.';

commit;
