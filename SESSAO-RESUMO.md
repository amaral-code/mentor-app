# Handoff da sessão — 07/09/2026 (madrugada)

## Onde está cada coisa
- Repo: https://github.com/amaral-code/mentor-app (branch main, tudo commitado)
- App temporário: https://legendary-cult-solaris-ids.trycloudflare.com (morre quando a sessão do Codespace cai)
- Worker IA: https://midnight-mentor-ia.miguelmito-amaral.workers.dev (publicado, com DEEPSEEK_API_KEY + API_TOKEN)
- Banco: projeto Supabase `bxidxlcismcvryznpomh`, 42/42 tabelas aplicadas
- Conta teste: miguelmito.amaral@gmail.com (papel student, SEM escola/turma — entrar com código no Perfil)
- Cloudflare Account ID: c55f7868aa40739985df40c179ce0a33

## O que foi feito hoje
1. Blindagem auditada (RLS, XSS, segredos, papéis) + PENDENTES de deploy
2. Tutorial corrigido (destaque após animação, ordem fixa, drawer auto no mobile)
3. Ligas: entrada local p/ demo + botão Criar liga + 3 ligas reais criadas no Miguel
4. Foco: botão arrastável, transparente, diminuir/aumentar, cliques corrigidos
5. Mentor: escopos por área, comunicativo conversa, respostas curtas, saudação curta
6. Chat: app manda provider/modelo; worker assume DeepSeek (wrangler.toml no repo)
7. Proxy mesma-origem (/tmp/proxy-ia.mjs + /ia) para furar bloqueio a workers.dev
8. Imagens: -12MB (originais removidas, avatar 2MB→152KB)
9. Zips no repo: banco-para-supabase.zip, blindagem.zip, parte2.zip

## PENDENTE (fazer amanhã)
1. 🔴 Miguel trocar senha `123456` (fraca e exposta no chat)
2. 🟡 Girar service_role (Supabase > Settings > API) — Miguel disse que ia passar pro amigo
3. 🟡 Apagar o token da Cloudflare que está no histórico do chat (API Tokens > Delete)
4. 🟡 Link permanente grátis (Vercel ou Cloudflare Pages) — guia em parte2.zip
5. 🟡 ALLOWED_ORIGIN no wrangler.toml quando tiver domínio final + redeploy
6. ⏳ Testar no celular em aba anônima (cache velho = tela travada antiga)

## Processos rodando no Codespace (morrem com a sessão)
- `node /tmp/proxy-ia.mjs` (porta 4174, precisa de IA_PROXY_TOKEN no env)
- `cloudflared tunnel --url http://localhost:4174`
- Para religar o link: rebuild (`VITE_AI_BASE_URL="/ia" ... npm run build`), subir proxy + túnel.
