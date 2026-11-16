/*
 * Desde o SDK 52 o Expo detecta o monorepo sozinho (workspaces do npm):
 * vigia a raiz e resolve @mentor/* pelos links em node_modules. Este
 * arquivo existe só para deixar isso explícito e para o `exports` dos
 * pacotes (`@mentor/core/srsEngine`) valer, que é como o web importa.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

// NativeWind compila o Tailwind (global.css) para estilos nativos.
module.exports = withNativeWind(config, { input: './global.css' });
