import { useEffect, useRef } from 'react';

const STAR_COUNT = 55;

interface Estrela {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  direction: 1 | -1;
}

/**
 * Canvas de estrelas do protótipo Minha Agenda (1:1 na lógica):
 * 55 partículas âmbar piscando, com resize da janela e limpeza do
 * requestAnimationFrame ao desmontar. Respeita reduced-motion.
 */
export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext('2d');
    if (!context) return;
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = context;

    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = () => canvas.clientWidth || window.innerWidth;
    const H = () => canvas.clientHeight || window.innerHeight;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W() * dpr;
      canvas.height = H() * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const estrelas: Estrela[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      radius: Math.random() * 1.3 + 0.3,
      alpha: Math.random() * 0.7 + 0.2,
      speed: Math.random() * 0.02 + 0.005,
      direction: Math.random() > 0.5 ? 1 : -1,
    }));

    let raf = 0;
    function desenhar() {
      ctx.clearRect(0, 0, W(), H());
      for (const s of estrelas) {
        if (!parado) {
          s.alpha += s.speed * s.direction;
          if (s.alpha > 0.85) { s.alpha = 0.85; s.direction = -1; }
          else if (s.alpha < 0.15) { s.alpha = 0.15; s.direction = 1; }
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(253, 230, 138, ${s.alpha * 0.45})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(desenhar);
    }
    raf = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas id="stars-canvas" ref={canvasRef} aria-hidden="true" />;
}
