/*
 * Tailwind do app (NativeWind). As cores vêm de @mentor/ui-tokens, a
 * mesma fonte do tailwind.config.js do web: `bg-azul-600` é o mesmo azul
 * nos dois apps.
 */
const { paletas, superficie, raio } = require('@mentor/ui-tokens/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: { ...paletas, superficie },
      borderRadius: { adesivo: `${raio.lg}px`, pilula: `${raio.pilula}px` },
    },
  },
  plugins: [],
};
