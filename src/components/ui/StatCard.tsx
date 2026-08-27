import React from 'react';
import { TrendingUp, TrendingDown, HelpCircle, Sparkles } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  badge?: React.ReactNode;
  tooltip?: string;
  className?: string;
  accent?: 'gold' | 'royal' | 'emerald' | 'amber' | 'ruby' | 'default';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  badge,
  tooltip,
  className,
  accent = 'default',
}) => {
  const accentBorders = {
    default: 'hover:border-border/80',
    gold: 'border-gold-500/25 hover:border-gold-500/50 bg-[#121628]',
    royal: 'hover:border-royal-500/40',
    emerald: 'hover:border-emerald-500/40',
    amber: 'hover:border-amber-500/40',
    ruby: 'hover:border-rose-500/40',
  };

  const accentIcons = {
    default: 'text-slate-400 bg-white/5 border border-white/5',
    gold: 'text-gold-400 bg-gold-500/10 border border-gold-500/30 shadow-sm shadow-gold-500/10',
    royal: 'text-royal-400 bg-royal-500/10 border border-royal-500/25',
    emerald: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25',
    amber: 'text-amber-400 bg-amber-500/10 border border-amber-500/25',
    ruby: 'text-rose-400 bg-rose-500/10 border border-rose-500/25',
  };

  return (
    <Card className={cn('p-5 sm:p-6 transition-all duration-200 group relative overflow-hidden', accentBorders[accent], className)}>
      {/* Top subtle highlight */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">{title}</span>
            {tooltip && (
              <span title={tooltip} className="text-slate-500 hover:text-gold-400 cursor-help transition-colors">
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight font-mono tabular-nums">
            {value}
          </div>
        </div>

        {icon && (
          <div className={cn('p-2.5 rounded-xl transition-transform group-hover:scale-105', accentIcons[accent])}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-border/40">
        {trend ? (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md',
                trend.isPositive !== false
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              )}
            >
              {trend.isPositive !== false ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
            </span>
            {trend.label && <span className="text-slate-500">{trend.label}</span>}
          </div>
        ) : subtitle ? (
          <span className="text-xs text-slate-400 leading-tight">{subtitle}</span>
        ) : (
          <div />
        )}

        {badge && <div>{badge}</div>}
      </div>
    </Card>
  );
};
