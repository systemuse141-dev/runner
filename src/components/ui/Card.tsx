import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'royal' | 'elevated' | 'glass' | 'interactive' | 'outline';
  glow?: 'none' | 'gold' | 'royal' | 'emerald';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  glow = 'none',
  className,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-surface/90 border border-border shadow-md shadow-black/30',
    royal: 'bg-[#121628]/95 border border-gold-500/25 shadow-xl shadow-black/50',
    elevated: 'bg-surface-elevated border border-border shadow-lg shadow-black/40',
    glass: 'bg-surface/75 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40',
    interactive:
      'bg-surface/85 hover:bg-surface-elevated border border-border hover:border-gold-500/40 transition-all duration-200 cursor-pointer shadow-md hover:shadow-gold-500/5',
    outline: 'bg-transparent border border-border/80 hover:border-gold-500/30 transition-colors',
  };

  const glowStyles = {
    none: '',
    gold: 'shadow-[0_0_30px_-5px_rgba(212,175,55,0.15)]',
    royal: 'shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)]',
    emerald: 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]',
  };

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        variantStyles[variant],
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-5 sm:p-6 border-b border-border/60 flex items-center justify-between gap-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3 className={cn('text-base sm:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => (
  <p className={cn('text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed', className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => <div className={cn('p-5 sm:p-6', className)} {...props}>{children}</div>;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-5 sm:p-6 pt-0 border-t border-border/60 mt-auto flex items-center justify-between gap-4', className)} {...props}>
    {children}
  </div>
);
