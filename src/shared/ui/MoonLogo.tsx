/**
 * Marca: lua crescente com uma estrela.
 *
 * Desenho chapado, em duas cores. A versão anterior tinha halo desfocado
 * (feGaussianBlur), gradiente na lua e na estrela e dois pontos de brilho:
 * a marca parecia um ícone de app genérico de "IA à noite" e, pequena na
 * barra lateral, virava uma mancha laranja. Chapada, ela é legível em 16px
 * e igual ao favicon.
 */
export function MoonLogo({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <path
        d="M72 26C52.1 26 36 42.1 36 62C36 81.9 52.1 98 72 98C76.2 98 80.2 97.2 83.8 95.8C65.5 93.2 51.5 77.4 51.5 58.2C51.5 40.8 63.8 26.2 80 26.2C77.4 26.1 74.7 26 72 26Z"
        fill="#e9a11c"
      />
      <path d="M84 42L86 47L91 49L86 51L84 56L82 51L77 49L82 47L84 42Z" fill="#f3efe6" />
    </svg>
  );
}
