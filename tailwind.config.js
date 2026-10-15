/** @type {import('tailwindcss').Config} */

/*
 * DIREÇÃO DE ARTE: "caderno sob a luminária".
 *
 * O produto é de quem estuda para o ENEM à noite. O escuro tem motivo,
 * mas o escuro anterior era o de qualquer template: azul-marinho, vidro
 * fosco, brilho neon e orbes flutuando. Aqui o escuro é o da MESA à noite
 * (grafite quente, não azul), a única luz é a da luminária (âmbar) e o
 * resto vem do material de estudo: papel, caneta azul, caneta vermelha
 * de correção e o verde do gabarito.
 *
 * Regras (registradas também no CLAUDE.md):
 *  - Âmbar só para ação principal e "onde você está". Nunca decoração.
 *  - Tinta (azul caneta) é a cor secundária: informação, apoio, links.
 *  - Superfície é plana. Sem blur, sem gradiente, sem brilho.
 *  - Sombra só em camada que flutua (modal, menu, aviso).
 *  - Raios curtos: o material é papel, não almofada.
 *
 * Os nomes `gray`, `slate`, `emerald`, `red`, `orange` e `amber` foram
 * mantidos com valores novos de propósito: são ~2 mil classes no código, e
 * trocar o valor muda o app inteiro sem reescrever a semântica de cada uma.
 * `gray` e `slate` passam a ser a MESMA escala: o app usava as duas sem
 * critério, e duas escalas de cinza parecidas são ruído.
 */

// Grafite quente. 500 e 600 passam de 4,5:1 sobre a mesa e a folha
// (medido): texto secundário legível sem precisar de "alto contraste".
const grafite = {
  50: '#f7f5f0',
  100: '#ede9e1',
  200: '#ddd7cb',
  300: '#c4bdaf',
  400: '#aaa395',
  500: '#968f81',
  600: '#8a8376',
  700: '#4d4840',
  800: '#34312b',
  900: '#23211d',
  950: '#171613',
};

// Luz da luminária. É a cor da marca (a lua do logo).
const luz = {
  50: '#fdf6e7',
  100: '#fbe9c2',
  200: '#f8d993',
  300: '#f6c865',
  400: '#f3b53f',
  500: '#e9a11c',
  600: '#c88512',
  700: '#9c660e',
  800: '#6e480c',
  900: '#47300a',
  950: '#2a1d07',
};

// Tinta de caneta azul. Secundária: informação, apoio, links, séries
// de gráfico que não são "certo/errado".
const tinta = {
  50: '#eef2fe',
  100: '#dbe3fd',
  200: '#c3d1fb',
  300: '#a4baf6',
  400: '#86a2f2',
  500: '#6584e6',
  600: '#4b68cc',
  700: '#3a52a3',
  800: '#2a3b74',
  900: '#1c284e',
  950: '#121a33',
};

// Verde do gabarito: acerto e sucesso. Menos neon que o emerald padrão.
const gabarito = {
  50: '#eef8f0',
  100: '#d6eedb',
  200: '#b5dfbd',
  300: '#97d3a2',
  400: '#7cc78a',
  500: '#58aa69',
  600: '#428a52',
  700: '#336b40',
  800: '#244c2e',
  900: '#17311e',
  950: '#0d1d12',
};

// Caneta vermelha da correção: erro, risco, ação destrutiva.
const correcao = {
  50: '#fdf0ec',
  100: '#fbdcd3',
  200: '#f7bcac',
  300: '#f4a08a',
  400: '#f08a70',
  500: '#e0623f',
  600: '#c24a2b',
  700: '#97381f',
  800: '#692716',
  900: '#43190f',
  950: '#280f09',
};

// Laranja de "fadiga": entre o alerta (âmbar) e o risco (vermelho).
const fadiga = {
  50: '#fdf2ea',
  100: '#fbe1cf',
  200: '#f7c6a5',
  300: '#f4ad80',
  400: '#f29a5e',
  500: '#e5793a',
  600: '#c25f25',
  700: '#97481c',
  800: '#683213',
  900: '#42200c',
  950: '#271307',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Branco puro sobre grafite quente fica azulado. Este é o branco
        // do papel, e vale para texto e para as transparências (bg-white/5).
        white: '#f6f3eb',
        gray: grafite,
        slate: grafite,
        amber: { ...luz, DEFAULT: luz[500] },
        tinta,
        emerald: gabarito,
        green: gabarito,
        red: correcao,
        rose: correcao,
        orange: fadiga,
        // Superfícies nomeadas. `midnight` continua existindo porque ~100
        // classes usam o nome; os valores agora são da mesa, não do céu.
        midnight: {
          950: '#100f0d',
          900: '#141310',
          850: '#181714',
          800: '#1c1a16',
          750: '#201e1a',
          700: '#24221d',
          600: '#33302a',
          border: '#33302a',
          borderActive: 'rgba(233, 161, 28, 0.45)',
        },
        mesa: '#141310',
        folha: { DEFAULT: '#1c1a16', 2: '#24221d', 3: '#2c2a24' },
        linha: { DEFAULT: '#33302a', forte: '#45413a' },
        papel: { DEFAULT: '#f3efe6', 2: '#ddd7cb' },
        mood: {
          stress: correcao[400],
          sad: tinta[400],
          focus: gabarito[400],
          anxiety: luz[400],
        },
      },
      fontFamily: {
        // Literata nasceu para leitura longa (livro digital). Aqui ela só
        // assina títulos e números grandes: dá ao app a voz de material de
        // estudo, e não de painel de startup.
        display: ['"Literata Variable"', 'Literata', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        inter: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        // Escala encurtada: o app inteiro usava 16px e 24px (rounded-2xl,
        // 3xl) e tudo virava almofada. Mesmos nomes, raios de papel.
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
        '3xl': '14px',
      },
      boxShadow: {
        // Uma sombra só, para o que flutua (modal, menu, aviso). Os nomes
        // antigos apontam para ela ou para nada, em vez de brilho.
        camada: '0 12px 32px -8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.35)',
        glass: '0 12px 32px -8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.35)',
        'glass-sm': 'none',
        'glass-lg': '0 12px 32px -8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.35)',
        glow: 'none',
        'glow-sm': 'none',
        'glow-lg': 'none',
        'glow-amber': 'none',
        'glow-amber-lg': 'none',
        'glow-amber-sm': 'none',
        inner: 'none',
        'inner-lg': 'none',
      },
      transitionTimingFunction: {
        // Saída rápida, chegada suave: resposta imediata sem tranco.
        padrao: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        resposta: '120ms',
        estado: '200ms',
      },
      /*
       * Movimento só comunica: entrada de camada, troca de estado, erro,
       * carregamento e recompensa. Os loops decorativos (orbes, órbitas,
       * partículas, brilho pulsando, mascote "respirando") foram
       * removidos: custavam GPU o tempo todo e não diziam nada.
       */
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.2,0,0,1)',
        'fade-up': 'fadeUp 0.24s cubic-bezier(0.2,0,0,1)',
        'fade-down': 'fadeDown 0.16s ease-out',
        'slide-up': 'slideUp 0.24s cubic-bezier(0.2,0,0,1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.2,0,0,1)',
        'scale-out': 'scaleOut 0.16s ease-in',
        // Erro no quiz: sacode curto, sem deslocar o layout (só transform).
        shake: 'shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97)',
        // "+20 XP" subindo e sumindo ao concluir uma tarefa.
        'fade-up-out': 'fadeUpOut 1s cubic-bezier(0.2,0,0,1) forwards',
        'sheet-up': 'sheetUp 0.28s cubic-bezier(0.2,0,0,1)',
        skeleton: 'skeleton 1.2s ease-in-out infinite',
        // Exercício de respiração: o movimento É o conteúdo.
        breathe: 'breathe 4s ease-in-out infinite',
        progress: 'progress 1s ease-out forwards',
        stroke: 'stroke 1.5s cubic-bezier(0.2,0,0,1) forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(4px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.97)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
        progress: { '0%': { width: '0%' } },
        stroke: { '0%': { strokeDashoffset: '100' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        fadeUpOut: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '25%': { opacity: '1', transform: 'translateY(-6px)' },
          '100%': { opacity: '0', transform: 'translateY(-30px)' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        skeleton: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
}
