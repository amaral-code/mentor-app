# Deep links (issue #57) e atalhos (#58)

## Endereços

| Endereço | Quem usa | O que acontece |
| --- | --- | --- |
| `/liga/<uuid>` | aluno | abre a liga; entrar continua sendo o botão da liga |
| `/turma/<código>` | aluno | Perfil com o código preenchido; entrar é o botão |
| `/vinculo/<código>` | responsável | aba "Outro estudante" com o código preenchido |
| `/?aba=<tela>` | aluno | abre a tela (push, atalho do app instalado) |

A interpretação mora em `packages/core/src/deepLinks.ts` para valer igual
no site e no app nativo. **Nenhum link executa ação sozinho**: entrar em
turma ou se vincular a um estudante sempre pede o toque de confirmação.
Link de outro domínio é ignorado.

Fluxo no web: `main.tsx` lê o endereço de abertura (e a mensagem do
service worker quando a pessoa toca numa notificação), guarda o destino em
`appStore.linkPendente` e volta a barra de endereço para `/`. O `App`
aplica depois do login, conforme o papel; destino que não serve ao papel
é descartado.

Na Vercel, `vercel.json` já reescreve toda rota fora de `/api/` para o
`index.html`, então `/liga/...` abre o app sem configuração extra.

## Onde gerar os links

- **Liga:** botão "Convidar" no topo da liga (só ligas reais; as de
  demonstração não têm linha no banco).
- **Turma:** ícone de link ao lado do código, em "Turmas e códigos"
  (secretaria e professor).
- **Vínculo:** "Enviar link" ao lado do código, em Perfil → Responsáveis.

## App nativo (depende do M2)

Quando o app Expo existir, o mesmo domínio vira App Link e Universal
Link. Falta, e depende de dados que só existem com o app publicado:

1. `https://<domínio>/.well-known/assetlinks.json` com o `package_name`
   do Android e a impressão SHA-256 do certificado de assinatura (EAS).
2. `https://<domínio>/.well-known/apple-app-site-association` (sem
   extensão, servido como `application/json`) com o `appID`
   (`<TeamID>.<bundle id>`) e os caminhos `/liga/*`, `/turma/*`,
   `/vinculo/*`.
3. No `app.json` do Expo: `intentFilters` (Android, com
   `autoVerify: true`) e `associatedDomains` (iOS).
4. Rotas do Expo Router com os mesmos caminhos, chamando
   `interpretarLink` do `@mentor/core`.

Sem o app instalado, o link abre o site: esse é o fallback pedido na issue.

## Atalhos do app instalado (#58, versão web)

Widgets de tela inicial são nativos (Glance no Android, WidgetKit no iOS)
e ficam para depois do M2. No web, o `manifest.json` ganhou `shortcuts`:
segurar o ícone do app instalado mostra "Revisões de hoje", "Fazer um
quiz" e "Perguntar ao Mentor", que abrem pelos mesmos deep links.
