/**
 * Configuração dinâmica por cima do app.json.
 *
 * Três variantes instaladas lado a lado no mesmo celular (development,
 * preview e production), cada uma com o próprio pacote e nome: quem
 * testa a preview não perde o app da loja. A variante vem do perfil do
 * eas.json (APP_VARIANT).
 *
 * O `projectId` do EAS NÃO está no repositório: ele nasce no primeiro
 * `npx eas init` e vem do ambiente (EAS_PROJECT_ID). Inventar um aqui
 * faria o EAS Update publicar para um projeto que não existe.
 */
const VARIANTE = process.env.APP_VARIANT || 'development';
const SUFIXO = { development: '.dev', preview: '.preview', production: '' }[VARIANTE] ?? '.dev';
const NOME = { development: 'Mentor (dev)', preview: 'Mentor (preview)', production: 'Midnight Mentor' }[VARIANTE] ?? 'Mentor (dev)';
const PROJETO = process.env.EAS_PROJECT_ID;

module.exports = ({ config }) => ({
  ...config,
  name: NOME,
  ios: { ...config.ios, bundleIdentifier: `br.com.midnightmentor.app${SUFIXO}` },
  android: { ...config.android, package: `br.com.midnightmentor.app${SUFIXO}` },
  // A versão do código nativo é a versão do app: atualização OTA só chega
  // a builds com o mesmo código nativo (um JS que chama um módulo novo
  // derrubaria um app antigo).
  runtimeVersion: { policy: 'appVersion' },
  updates: PROJETO ? { url: `https://u.expo.dev/${PROJETO}`, fallbackToCacheTimeout: 0 } : { enabled: false },
  extra: { ...config.extra, variante: VARIANTE, ...(PROJETO ? { eas: { projectId: PROJETO } } : {}) },
});
