/*
 * Desde o SDK 52 o Expo detecta o monorepo sozinho (workspaces do npm):
 * vigia a raiz e resolve @mentor/* pelos links em node_modules. Este
 * arquivo existe só para deixar isso explícito e para o `exports` dos
 * pacotes (`@mentor/core/srsEngine`) valer, que é como o web importa.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
