/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
          midnight: {
            950: '#060911',
            900: '#0B0F19',
            850: '#0E131F',
            800: '#121826',
            750: '#161B28',
            700: '#1E2538',
            600: '#2A3B63',
            border: 'rgba(255, 255, 255, 0.08)',
            borderActive: 'rgba(245, 158, 11, 0.4)',
          },
        amberBrand: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        emeraldBrand: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        glass: {
          DEFAULT: 'rgba(17,24,39,0.75)',
          light: 'rgba(30,41,59,0.4)',
          border: 'rgba(255,255,255,0.05)',
          hover: 'rgba(255,255,255,0.08)',
        },
        amber: {
          DEFAULT: '#f59e0b',
          glow: '#F59E0B',
          dark: '#D97706',
          light: '#FDE047',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        mood: {
          stress: '#ef4444',
          sad: '#a855f7',
          focus: '#10b981',
          anxiety: '#f59e0b',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'sans-serif'],
        inter: ['"Inter"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
        'glass-sm': '0 4px 16px rgba(0,0,0,0.3)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.5)',
        glow: '0 0 24px rgba(245,158,11,0.15)',
        'glow-sm': '0 0 12px rgba(245,158,11,0.1)',
        'glow-lg': '0 0 40px rgba(245,158,11,0.2)',
        'glow-amber': '0 0 25px -4px rgba(245, 158, 11, 0.45)',
        'glow-amber-lg': '0 0 50px -2px rgba(245, 158, 11, 0.65)',
        'glow-amber-sm': '0 0 14px -2px rgba(245, 158, 11, 0.35)',
        inner: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        'inner-lg': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backdropBlur: {
        glass: '24px',
        heavy: '48px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1)',
        'fade-down': 'fadeDown 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-out': 'scaleOut 0.2s ease-in',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'pulse-red': 'pulseRed 1.5s ease-in-out infinite',
        breathe: 'breathe 4s ease-in-out infinite',
        flame: 'flame 0.6s ease-in-out infinite alternate',
        shimmer: 'shimmer 2.5s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'progress': 'progress 1s ease-out forwards',
        stroke: 'stroke 1.5s cubic-bezier(0.16,1,0.3,1) forwards',
        // Erro no quiz: sacode curto, sem deslocar o layout (so transform).
        shake: 'shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97)',
        // "+10 XP" subindo e sumindo ao concluir uma tarefa.
        'fade-up-out': 'fadeUpOut 1s cubic-bezier(0.16,1,0.3,1) forwards',
        // Bottom sheet do menu "Mais".
        'sheet-up': 'sheetUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        // Brilho percorrendo o skeleton enquanto carrega.
        'skeleton': 'skeleton 1.2s ease-in-out infinite',
        // Idle do mascote nos estados vazios: so translateY, sem tocar
        // em layout. 4px e o suficiente para dar vida sem distrair.
        'float-suave': 'floatSuave 3s ease-in-out infinite',
        /* Protótipo AGcode (tela do Mentor): orbes, hero, órbitas,
           partículas, twinkles, shimmer líquido e respiro do mascote. */
        'orb-1': 'orbFloat1 10s ease-in-out infinite',
        'orb-2': 'orbFloat2 12s ease-in-out infinite',
        'orb-3': 'orbFloat3 9s ease-in-out infinite',
        'hero-bulb': 'pulseAuraHero 3.6s ease-in-out infinite',
        'spin-orbit': 'ringSpinClockwise 16s linear infinite',
        'spin-orbit-rev': 'ringSpinCounter 11s linear infinite',
        'particle-1': 'particleOrbit 7s linear infinite',
        'particle-2': 'particleOrbitReverse 9s linear infinite',
        'twinkle-fast': 'starTwinkleFast 3.2s ease-in-out infinite',
        'twinkle-slow': 'starTwinkleSlow 4.5s ease-in-out infinite',
        'shimmer-sweep': 'xpLiquidShimmer 2.2s cubic-bezier(0.4, 0.2, 1) infinite',
        'mascot-interactive': 'mascotBreatheAG 5s ease-in-out infinite',
        'emerald-ping': 'pulseEmeraldDot 2s cubic-bezier(0.4, 0.6, 1) infinite',
        /* Protótipo Minha Agenda: flutuação, pulsos lentos e CTA com glow. */
        'float': 'agendaFloat 3.5s ease-in-out infinite',
        'pulse-slow': 'agendaPulseSlow 6s ease-in-out infinite',
        'glow-cta': 'agendaGlowButton 2.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeDown: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.92)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.3)' },
          '50%': { boxShadow: '0 0 0 16px rgba(239,68,68,0)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
        flame: {
          '0%': { transform: 'scale(1) rotate(-2deg)', filter: 'brightness(1)' },
          '100%': { transform: 'scale(1.12) rotate(2deg)', filter: 'brightness(1.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        progress: {
          '0%': { width: '0%' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        fadeUpOut: {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.9)' },
          '25%': { opacity: '1', transform: 'translateY(-6px) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-34px) scale(1)' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        skeleton: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.8' },
        },
        floatSuave: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        /* Keyframes do protótipo AGcode (nomes originais preservados). */
        orbFloat1: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)', opacity: '0.35' },
          '33%': { transform: 'translate(45px, -35px) scale(1.18)', opacity: '0.55' },
          '66%': { transform: 'translate(-25px, 20px) scale(0.95)', opacity: '0.4' },
        },
        orbFloat2: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)', opacity: '0.28' },
          '40%': { transform: 'translate(-40px, 35px) scale(1.15)', opacity: '0.5' },
          '80%': { transform: 'translate(25px, -20px) scale(1.05)', opacity: '0.35' },
        },
        orbFloat3: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(0.95)', opacity: '0.22' },
          '50%': { transform: 'translate(35px, 30px) scale(1.18)', opacity: '0.42' },
        },
        pulseAuraHero: {
          '0%, 100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 35px 8px rgba(245,158,11,0.32), 0 0 70px 22px rgba(245,158,11,0.16), inset 0 1px 1px rgba(255,255,255,0.4)',
          },
          '50%': {
            transform: 'scale(1.045)',
            boxShadow: '0 0 58px 18px rgba(245,158,11,0.52), 0 0 105px 36px rgba(245,158,11,0.25), inset 0 1px 2px rgba(255,255,255,0.6)',
          },
        },
        ringSpinClockwise: { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        ringSpinCounter: { '0%': { transform: 'rotate(360deg)' }, '100%': { transform: 'rotate(0deg)' } },
        particleOrbit: {
          '0%': { transform: 'rotate(0deg) translateX(74px) rotate(0deg)', opacity: '0.2' },
          '50%': { opacity: '0.95', transform: 'rotate(180deg) translateX(74px) rotate(-180deg)' },
          '100%': { transform: 'rotate(360deg) translateX(74px) rotate(-360deg)', opacity: '0.2' },
        },
        particleOrbitReverse: {
          '0%': { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)', opacity: '0.3' },
          '50%': { opacity: '0.9', transform: 'rotate(180deg) translateX(60px) rotate(-180deg)' },
          '100%': { transform: 'rotate(0deg) translateX(60px) rotate(0deg)', opacity: '0.3' },
        },
        starTwinkleFast: {
          '0%, 100%': { opacity: '0.2', transform: 'scale(0.75)' },
          '50%': { opacity: '1', transform: 'scale(1.35)', filter: 'drop-shadow(0 0 8px rgba(253,224,71,0.9))' },
        },
        starTwinkleSlow: {
          '0%, 100%': { opacity: '0.15', transform: 'scale(0.85)' },
          '50%': { opacity: '0.85', transform: 'scale(1.2)', filter: 'drop-shadow(0 0 6px rgba(103,232,249,0.8))' },
        },
        xpLiquidShimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(250%)' },
        },
        cyberBorderGlowEffect: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        flashGlow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 0 transparent)' },
          '50%': { filter: 'drop-shadow(0 0 25px rgba(245,158,11,0.85))' },
        },
        mascotBreatheAG: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-3px) scale(1.02)' },
        },
        pulseEmeraldDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(52,211,153,0.6)' },
          '70%': { boxShadow: '0 0 0 6px rgba(52,211,153,0)' },
        },
        /* Keyframes do protótipo Minha Agenda (nomes originais). */
        agendaFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        agendaPulseSlow: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.08)' },
        },
        agendaGlowButton: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(245,158,11,0.4), 0 4px 6px -1px rgba(0,0,0,0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(245,158,11,0.7), 0 10px 15px -3px rgba(245,158,11,0.3)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'amber-glow': 'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
