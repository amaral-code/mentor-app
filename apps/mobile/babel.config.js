// NativeWind: o JSX passa pelo `nativewind` para entender `className`.
// O plugin do Reanimated/Worklets continua vindo do babel-preset-expo.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
