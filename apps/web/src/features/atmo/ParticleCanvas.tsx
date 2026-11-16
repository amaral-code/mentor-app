import { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { getMoodColor } from '../../shared/lib/emotionEngine';
import { MoodType } from '../../shared/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

function getSpeed(mood: MoodType): number {
  switch (mood) {
    case 'stress': return 1.2;
    case 'anxiety': return 1.0;
    case 'sadness': return 0.3;
    case 'tired': return 0.3;
    case 'demotivated': return 0.4;
    case 'focused': return 0.6;
    case 'motivated': return 0.7;
    case 'happy': return 0.8;
    case 'energetic': return 1.0;
    default: return 0.5;
  }
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const colorRef = useRef('#10b981');
  const targetColorRef = useRef('#10b981');
  const speedRef = useRef(0.5);
  const targetSpeedRef = useRef(0.5);

  const currentMood = useAppStore(s => s.currentMood);

  useEffect(() => {
    targetColorRef.current = getMoodColor(currentMood);
    targetSpeedRef.current = getSpeed(currentMood);
  }, [currentMood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    /*
     * Custo do fundo animado.
     *
     * Este laco roda o tempo todo, em todas as telas. Sob CPU 4x ele
     * sozinho ja produzia tarefas longas com o app parado. Tres ajustes:
     *   - menos particulas em tela pequena, onde a CPU e mais fraca;
     *   - pausa quando a aba esta em segundo plano (o usuario nao ve);
     *   - desliga por completo com movimento reduzido, que e um pedido
     *     explicito de menos animacao, nao de animacao mais lenta.
     */
    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzMovimento) {
      window.removeEventListener('resize', resize);
      return;
    }
    const count = window.innerWidth < 768 ? 24 : 50;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * (canvas.width || window.innerWidth),
      y: Math.random() * (canvas.height || window.innerHeight),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    let animId: number;

    function lerp(current: number, target: number, t: number) {
      return current + (target - current) * t;
    }

    function animate() {
      const c = canvasRef.current;
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);

      colorRef.current = lerpColor(colorRef.current, targetColorRef.current, 0.02);
      speedRef.current = lerp(speedRef.current, targetSpeedRef.current, 0.02);

      const particles = particlesRef.current;
      for (const p of particles) {
        p.x += p.vx * speedRef.current;
        p.y += p.vy * speedRef.current;

        if (p.x < 0) p.x = c.width;
        if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height;
        if (p.y > c.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = colorRef.current;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // document.hidden: aba em segundo plano nao precisa desenhar nada.
      animId = requestAnimationFrame(document.hidden ? () => { animId = requestAnimationFrame(animate); } : animate);
    }

    animate();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.3 }}
    />
  );
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${rr.toString(16).padStart(2, '0')}${rg.toString(16).padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`;
}
