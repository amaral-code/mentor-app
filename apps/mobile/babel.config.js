// babel-preset-expo já inclui o plugin do Reanimated/Worklets quando ele
// está instalado; nada a acrescentar.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
