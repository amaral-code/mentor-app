# ADR 001 — React Native com Expo para Android, iOS e notebook

- **Status:** proposto (aguardando aprovação da equipe)
- **Data:** 2026-11-15
- **Issue:** #22

## Contexto

Hoje o Midnight Mentor é um app web (React 19 + Vite + Tailwind, PWA) com backend Supabase e back-end de IA (`server/worker.js`) rodando como funções serverless na Vercel. Para virar produto, ele precisa:

1. **Estar nas lojas** (Google Play e App Store). É lá que os adolescentes procuram apps.
2. **Usar recursos nativos** que o navegador não oferece direito:
   - o Escudo de Dopamina precisa saber se a **tela está bloqueada** (já existe código Kotlin/Swift em `mobile/react-native/`);
   - notificações push confiáveis;
   - câmera para a redação por foto;
   - áudio em segundo plano;
   - widgets.
3. **Continuar funcionando no notebook**, onde muitos alunos estudam e onde ficam os painéis de escola, pais e psicólogo.
4. Ser mantido por **uma equipe pequena que já sabe React e TypeScript**.

## Decisão

Usar **um único código** com:

| Peça | Escolha |
| --- | --- |
| Framework | **Expo** (React Native) com *development builds* (não só Expo Go) |
| Notebook | **react-native-web** via Expo Web, publicado como site/PWA |
| Navegação | **Expo Router** (rotas por arquivo, deep links e URLs no web) |
| Estilo | **NativeWind** (Tailwind no React Native), reaproveitando os tokens do `tailwind.config.js` |
| Código nativo | **Expo Modules API** / config plugins (o FocusShield vira um módulo Expo) |
| Build e distribuição | **EAS Build** e **EAS Update** (atualização OTA) |
| Estado e dados | Zustand + Supabase, em pacotes compartilhados do monorepo |

### Organização do código (monorepo, milestone M1)

```
apps/
  web/        app Vite atual (continua no ar durante a transição)
  mobile/     app Expo: Android, iOS e web
packages/
  core/       engines puras (SRS, SSC, burnout, quiz, redação, ranking...) sem DOM
  api/        cliente Supabase + repositories
  ui-tokens/  cores, tipografia e espaçamento
server/       back-end de IA: Vercel /api/* ou Cloudflare Worker (sem mudança)
supabase/     migrations (sem mudança)
```

### Divisão por plataforma

| Funcionalidade | Android / iOS | Notebook (web) |
| --- | --- | --- |
| Aluno: dashboard, chat, quiz, redação, SRS, caderno, ligas, bem-estar | ✅ | ✅ |
| Escudo de Dopamina (tela bloqueada) | ✅ módulo nativo | ⚠️ aproximação por visibilidade da aba |
| Push, widgets, áudio em segundo plano | ✅ | ⚠️ limitado |
| Painéis de educador, pais e psicólogo | Versão simplificada (pais) | ✅ completo |
| Importação CSV de turmas | — | ✅ |

## Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| **Só PWA** (manter como está) | Não entra na App Store; no iOS o push é limitado e não há como saber se a tela está bloqueada. O Escudo de Dopamina, que é um diferencial do produto, não funciona direito. |
| **Capacitor** (empacotar o web atual) | Migração mais rápida, mas a interface continua sendo uma WebView: fica pior em celulares de entrada, que são a maioria do público. Os módulos nativos teriam que ser reescritos como plugins Capacitor. |
| **Flutter** | Bom desempenho, mas obriga a reescrever tudo em Dart e jogar fora o conhecimento de React/TS da equipe e as engines já testadas (425 testes). |
| **React Native sem Expo** | Mais configuração manual de Xcode/Gradle e sem EAS. O Expo hoje permite código nativo próprio por meio de módulos e config plugins, então não perdemos nada. |

## Estratégia de transição

1. **M1:** extrair engines e acesso a dados para `packages/`. O app web atual passa a consumir esses pacotes, sem mudança visível.
2. **M2:** criar `apps/mobile` com navegação, login e design system. Builds internos via EAS para a equipe.
3. **M3:** portar as funcionalidades do aluno, uma por issue. O web atual continua sendo o produto em uso.
4. **M6:** com os painéis portados para o Expo Web, desligar o app Vite antigo.

Regra durante a transição: **lógica nova vai para `packages/core`**, nunca direto em uma tela, para servir às duas versões.

## Consequências

**Positivas**

- Um código para três plataformas, com as engines atuais reaproveitadas.
- Acesso nativo de verdade (FocusShield, push, câmera, áudio).
- Correções rápidas sem passar pela revisão das lojas (EAS Update, dentro das regras das lojas).

**Negativas / riscos**

- Bibliotecas só de web precisam de substituto ou de WebView:
  - `chart.js` → victory-native ou similar;
  - `mermaid` → WebView ou render com react-native-svg;
  - KaTeX → WebView.
- Algumas telas vão precisar de layout próprio para tela grande no web.
- Custos:
  - conta Apple Developer (US$ 99/ano);
  - conta Google Play (US$ 25, uma vez);
  - plano EAS, se o gratuito não bastar.
- A equipe precisa aprender as diferenças do React Native: sem DOM, estilos e listas diferentes.

## Pontos para a equipe decidir na revisão

- [ ] Gerenciador de pacotes do monorepo: npm workspaces ou pnpm
- [ ] Biblioteca de gráficos nativa
- [ ] Quem cuida das contas Apple, Google e Expo (de preferência contas de organização, não pessoais)
