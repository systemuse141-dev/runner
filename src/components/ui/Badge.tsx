import React from 'react';
import { cn, getStatusBadgeVariant } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'cyan' | 'auto';
  status?: string;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  status,
  size = 'md',
  dot = false,
  className,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  if (status || variant === 'auto') {
    const s = status || (typeof children === 'string' ? children : 'ACTIVE');
    const autoStyle = getStatusBadgeVariant(s);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase font-mono transition-colors',
          autoStyle.bg,
          autoStyle.text,
          autoStyle.border,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {dot && <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', autoStyle.dot)} />}
        {children || status}
      </span>
    );
  }

  const variantClasses = {
    default: 'bg-slate-800/60 text-slate-300 border-white/10',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };

  const dotClasses = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400',
    danger: 'bg-rose-400',
    warning: 'bg-amber-400',
    info: 'bg-blue-400',
    purple: 'bg-indigo-400',
    cyan: 'bg-cyan-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border tracking-wide transition-colors',
        variantClasses[variant as keyof typeof variantClasses] || variantClasses.default,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotClasses[variant as keyof typeof dotClasses] || 'bg-slate-400'
          )}
        />
      )}
      {children}
    </span>
  );
};
