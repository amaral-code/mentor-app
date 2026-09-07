/**
 * Logo da lua crescente com estrela (Design System v2.4, assets.logo).
 *
 * O markup veio do spec com referencias a defs (neonBlur, moonGlow,
 * starGrad); os <defs> abaixo materializam esses nomes para o SVG
 * renderizar de verdade em vez de cair em fill preto.
 */
export function MoonLogo({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <defs>
        <filter id="mm-neon-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id="mm-moon-glow" x1="36" y1="26" x2="84" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="mm-star-grad" x1="77" y1="42" x2="91" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="#F59E0B" fillOpacity="0.15" filter="url(#mm-neon-blur)" />
      <path
        d="M72 26C52.1 26 36 42.1 36 62C36 81.9 52.1 98 72 98C76.2 98 80.2 97.2 83.8 95.8C65.5 93.2 51.5 77.4 51.5 58.2C51.5 40.8 63.8 26.2 80 26.2C77.4 26.1 74.7 26 72 26Z"
        fill="url(#mm-moon-glow)"
      />
      <path
        d="M84 42L86 47L91 49L86 51L84 56L82 51L77 49L82 47L84 42Z"
        fill="url(#mm-star-grad)"
      />
      <circle cx="92" cy="34" r="2" fill="#FEF08A" />
      <circle cx="42" cy="38" r="1.5" fill="#FEF08A" opacity="0.8" />
    </svg>
  );
}
