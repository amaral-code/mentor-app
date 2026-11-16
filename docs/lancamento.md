# Lançamento (M8)

O que do M8 depende de decisão, conta ou contrato do dono, e o que já
está pronto no código para cada passo.

## Versão notebook com domínio próprio (#73)

O app web já é publicado na Vercel com deploy da `main` e é PWA
instalável (manifesto, service worker, atalhos). Falta:

- [ ] Registrar o domínio e apontar para a Vercel (Settings, Domains).
      A Vercel emite o HTTPS sozinha.
- [ ] `ALLOWED_ORIGIN=https://<domínio>` nas variáveis da Vercel (e no
      `wrangler secret`, se usar a Cloudflare). Sem ele o back-end
      aceita qualquer origem.
- [ ] Supabase, Authentication, URL Configuration: Site URL e Redirect
      URLs com o domínio (senão o "esqueci minha senha" volta para o
      endereço antigo).
- [ ] `VAPID_SUBJECT=mailto:<contato do domínio>` (push).

## Landing e ASO (#76)

- Landing pronta em `/conheca/` (HTML estático, sem login, abre rápido
  e funciona sem JavaScript). Campos `[E-MAIL COMERCIAL]` a preencher.
  Para ela virar a página inicial do domínio, aponte o domínio raiz para
  `/conheca/` e o app para um subdomínio, ou troque a ordem no
  `vercel.json` (decisão do dono).
- Palavras-chave já no `<meta>`: ENEM, vestibular, redação ENEM,
  simulado, quiz ENEM, revisão espaçada.
- Kit para escolas: o roteiro da demonstração está em
  `supabase/migrations/verificacao/preparar_demonstracao.sql`.
- Links das lojas entram na landing quando o app nativo existir.

## Google Play (#71) e App Store (#72)

Dependem do app nativo (M2, Expo), que ainda não existe. O que já serve:

- Exclusão de conta dentro do app e política de privacidade publicada
  (exigência das duas lojas): ver `docs/lgpd.md`.
- **Data Safety / App Privacy**: responder a partir do inventário em
  `docs/lgpd.md`. Coletado: nome, e-mail, data de nascimento, conteúdo
  criado (redações, fotos, conversas), dados de saúde (bem-estar),
  interação com o app (só com consentimento), diagnóstico (erros). Nada
  é vendido nem usado para publicidade. Dado em trânsito é cifrado
  (HTTPS). O usuário pode pedir a exclusão.
- Classificação etária: público adolescente e conteúdo de saúde mental
  com orientação de crise (CVV 188). Na Play, avaliar a Política de
  Famílias se o público incluir menores de 13.
- Preferir conta de **organização** na Play: conta pessoal nova exige
  teste fechado com 12 testadores por 14 dias.
- Sign in with Apple passa a ser exigido na App Store se houver login
  social; hoje o login é só e-mail e senha.

## Monetização (#75)

Decisão de negócio, nada implementado. Pontos que o código já impõe:

- Limite de alunos por escola existe (`escolas.limite_alunos`, 034): é a
  base do plano para escolas.
- **Bem-estar e crise nunca ficam atrás de paywall**: a resposta fixa do
  CVV, o índice de cansaço e o alerta ao responsável. Qualquer paywall
  precisa respeitar isso.
- Assinatura dentro do app nativo tem de usar a compra das lojas (Play
  Billing e StoreKit); a sugestão do issue é o RevenueCat. Na web, o
  Mercado Pago já é usado para consultas.
- Escola pública: gratuidade por `limite_alunos` sem cobrança.
