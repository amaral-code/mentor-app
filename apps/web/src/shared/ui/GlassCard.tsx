import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  mood?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'none';
}

export function GlassCard({
  children,
  className = '',
  mood,
  onClick,
  hover,
  padding = 'md',
}: GlassCardProps) {
  const moodClass = mood ? `card-mood-${mood}` : '';
  const paddingClass = padding === 'md' ? 'p-5' : padding === 'sm' ? 'p-4' : '';

  return (
    <div
      onClick={onClick}
      className={`glass-card rounded-2xl ${paddingClass} ${moodClass} ${hover ? 'cursor-pointer' : ''} animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}
