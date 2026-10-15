import { ReactNode } from 'react';

interface PainelProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'none';
}

/**
 * Folha sobre a mesa: superfície plana com borda fina (classe `.painel`).
 * Chamava-se GlassCard, do tempo do vidro fosco; a direção de arte de
 * 2026-10 tirou o desfoque e o nome foi junto.
 */
export function Painel({ children, className = '', onClick, padding = 'md' }: PainelProps) {
  const paddingClass = padding === 'md' ? 'p-5' : padding === 'sm' ? 'p-4' : '';
  return (
    <div onClick={onClick} className={`painel rounded-2xl ${paddingClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      {children}
    </div>
  );
}
