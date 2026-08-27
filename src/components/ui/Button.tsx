import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'royal' | 'gold' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'royal',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 select-none rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] font-sans';

    const variants = {
      royal:
        'bg-gradient-to-r from-gold-500 via-gold-400 to-gold-600 text-slate-950 font-bold shadow-lg shadow-gold-500/20 hover:brightness-110 active:brightness-95 border border-gold-300/40',
      gold:
        'bg-[#181D33] text-gold-300 hover:text-gold-200 border border-gold-500/40 hover:border-gold-500 hover:bg-[#1E2542] shadow-md shadow-black/40',
      primary:
        'bg-royal-600 hover:bg-royal-500 text-white shadow-md shadow-royal-600/25 border border-royal-400/30 active:bg-royal-700',
      secondary:
        'bg-surface-elevated hover:bg-surface-highlight text-slate-200 border border-border shadow-sm active:bg-surface',
      outline:
        'bg-transparent hover:bg-white/5 text-slate-300 hover:text-gold-300 border border-border hover:border-gold-500/40',
      ghost:
        'bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-100 border border-transparent',
      danger:
        'bg-rose-600/90 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 border border-rose-500/30 active:bg-rose-700',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 border border-emerald-500/30 active:bg-emerald-700',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[32px]',
      md: 'text-sm px-4 py-2.5 gap-2 min-h-[40px]',
      lg: 'text-base px-6 py-3 gap-2.5 min-h-[48px]',
      icon: 'p-2.5 min-h-[40px] min-w-[40px]',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
