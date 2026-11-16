# Midnight Mentor no celular (`@mentor/mobile`)

App Expo (SDK 58, Expo Router) com a área do **aluno**: Android, iOS e
navegador a partir do mesmo código. Decisão em `docs/adr/001-expo-react-native.md`.

Painéis de responsável, professor, secretaria e psicólogo continuam no
site (`apps/web`): essas contas veem um aviso com o link do painel.

## Rodar

```bash
npm ci                               # na raiz do monorepo
cp .env.example apps/mobile/.env     # e deixe só o bloco "APP NATIVO"
npm run start --workspace @mentor/mobile
```

| Onde | Como | O que não funciona |
| --- | --- | --- |
| Navegador | tecla `w` no terminal do Expo | Escudo mede por segundo plano (aproximado); sem download de pílula |
| Expo Go | QR code | Escudo nativo (FocusShield) não existe: cai no modo aproximado |
| Development build | `npx expo run:android` / `npx expo run:ios` ou EAS (#36) | nada: é o app de verdade |

`EXPO_PUBLIC_SITE_URL` é a única variável obrigatória: é o site que serve
`/api` (config, chat, redação, TTS). Supabase e provedor de IA vêm de
`/api/config` em tempo de execução, como no web.

## Entrar sem senha (link, Google, Apple)

Configuração no painel do Supabase, uma vez por ambiente:

1. Authentication > URL Configuration > Redirect URLs: acrescente
   `midnightmentor://entrar`, `midnightmentor://**` (builds) e
   `exp://**` (Expo Go, só em dev).
2. Authentication > Providers: ligue Google (client id e secret do Google
   Cloud) e Apple (Services ID, chave .p8, Team ID). Na Apple, o bundle
   `br.com.midnightmentor.app` precisa da capacidade Sign in with Apple.

O link do e-mail é só para conta que já existe (`shouldCreateUser:
false`). O app usa PKCE: o que volta no link é um código de uso único,
não o token.

## Builds internos e atualização OTA (EAS)

Uma vez, com a conta Expo da organização (não pessoal):

```bash
cd apps/mobile
npx eas login
npx eas init                       # cria o projeto e mostra o projectId
```

Guarde o `projectId` como `EAS_PROJECT_ID` (variável local e segredo do
GitHub) junto com um `EXPO_TOKEN` de robô. Daí:

| Perfil | Para quê | Instala como |
| --- | --- | --- |
| `development` | quem desenvolve (Expo Dev Client) | "Mentor (dev)", APK / build interno |
| `preview` | a equipe testar antes da loja | "Mentor (preview)", link de instalação |
| `production` | lojas | "Midnight Mentor" |

As três variantes convivem no mesmo celular (pacotes diferentes). A
build preview sai com `npx eas build --profile preview --platform all`
e cada pessoa da equipe instala pelo link que o EAS devolve (no iOS, o
aparelho precisa estar cadastrado: `npx eas device:create`).

Correção só de JavaScript chega sem passar pela loja: o workflow
`.github/workflows/eas.yml` publica um `eas update` no canal `preview`
a cada merge na `main` que mexa no app. Build novo só com "[build]" na
mensagem do commit ou pelo botão do workflow: OTA nunca entrega código
nativo novo (`runtimeVersion` segue a versão do app).

## Estrutura

```
app/                      rotas (Expo Router)
  _layout.tsx             boot, sessão e as portas por papel (Stack.Protected)
  entrar, trocar-senha, boas-vindas, outro-perfil
  (aluno)/(abas)/         Central, Mentor, Quiz, Ligas, Mais
  (aluno)/                redacao, revisoes, foco, audio, caderno/, liga/[id],
                          ranking, flashcards, bem-estar, loja
src/
  boot.ts                 polyfills, plataforma e cliente Supabase (nessa ordem)
  plataforma.ts           adaptadores do @mentor/core (kv-store, NetInfo, AppState)
  sessao/                 sessão no cofre do sistema e carga dos dados
  ui/                     tokens do visual lúdico e componentes base
  features/<tela>/        peças de cada tela
  lib/                    lógica pura do app (com testes no Vitest)
modules/focus-shield/     módulo nativo do Escudo de Dopamina (Kotlin + Swift)
```

Arquivo `.web.ts` ao lado de um `.ts` é a versão do navegador (o Metro
escolhe pelo sufixo): armazenamento, `fetch` com streaming, foto no
FormData, KaTeX e arquivos de áudio.

## Regras que valem aqui também

- Lógica nova vai para `packages/` (core, api, state). A tela só desenha.
- Texto que o aluno lê segue a regra de escrita do `CLAUDE.md`: o teste
  `regraPontuacao` varre `apps/mobile/app` e `apps/mobile/src`.
- Sessão do Supabase só no cofre do sistema (expo-secure-store), em
  pedaços de 1800 caracteres. Nada de sessão em armazenamento comum.
- `process.env.EXPO_PUBLIC_X` sempre escrito por extenso: o Expo não
  troca `process.env[nome]` pelo valor.

## O que foi verificado e o que falta verificar

- Tipos, lint e testes (`npm run typecheck`, `npm test`) rodam no CI.
- As telas foram abertas no navegador (export web do Expo) com o
  Supabase simulado: Central, Mentor com streaming, Redação offline, Quiz,
  Flashcards, Revisões, Foco (com a pausa consciente), Pílulas, Caderno
  com mapa mental, Ligas, Ranking, Bem-estar, crise e Loja.
- **Não verificado em aparelho**: o Kotlin e o Swift do FocusShield, o
  áudio em segundo plano com a tela bloqueada, a câmera com a moldura e o
  desempenho em Android intermediário. Isso pede um development build
  (EAS, #36) e o roteiro do `modules/focus-shield/README.md`.
