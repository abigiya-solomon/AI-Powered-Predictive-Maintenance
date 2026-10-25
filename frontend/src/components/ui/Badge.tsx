import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'healthy' | 'warning' | 'critical' | 'neutral' | 'cyan';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    healthy: 'bg-emerald-950/70 text-emerald-400 border-emerald-700/60',
    warning: 'bg-amber-950/70 text-amber-400 border-amber-700/60',
    critical: 'bg-rose-950/70 text-rose-400 border-rose-700/60',
    neutral: 'bg-steel-800 text-steel-300 border-steel-700',
    cyan: 'bg-cyan-950/70 text-cyanAccent-400 border-cyan-800/60',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border font-mono ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
