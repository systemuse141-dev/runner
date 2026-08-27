import React from 'react';
import { TrainingOrder } from '../../types';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDateTime, cn } from '../../lib/utils';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface OrderRowProps {
  order: TrainingOrder;
}

export const OrderRow: React.FC<OrderRowProps> = ({ order }) => {
  const isCall = order.direction === 'CALL' || order.direction === 'BUY';
  const isWin = order.result === 'WIN';
  const isLose = order.result === 'LOSE';
  const isTie = order.result === 'TIE';

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border hover:border-white/20 transition-all font-mono flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Asset & Direction */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
            isCall ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          )}
        >
          {isCall ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100">{order.pair}</span>
            <span
              className={cn(
                'text-[10px] font-extrabold px-1.5 py-0.2 rounded',
                isCall ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              )}
            >
              {order.direction}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">#{order.id} • {order.duration}s</p>
        </div>
      </div>

      {/* Execution Prices */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans">Entry Price</span>
          <span className="font-semibold text-slate-300">{formatCurrency(order.entryPrice)}</span>
        </div>

        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans">Settled Price</span>
          <span className="font-semibold text-slate-300">
            {order.settlementPrice ? formatCurrency(order.settlementPrice) : '—'}
          </span>
        </div>

        <div className="hidden sm:block">
          <span className="text-slate-500 block text-[10px] uppercase font-sans">Execution Time</span>
          <span className="text-slate-400 text-[11px]">{formatDateTime(order.openedAt)}</span>
        </div>
      </div>

      {/* P/L and Result */}
      <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
        <div className="text-left md:text-right">
          <span className="text-slate-500 block text-[10px] uppercase font-sans">Invested / P&L</span>
          <div className="flex items-baseline md:justify-end gap-2">
            <span className="text-slate-400">{formatCurrency(order.amount)}</span>
            <span
              className={cn(
                'font-bold text-sm',
                isWin && 'text-emerald-400',
                isLose && 'text-rose-400',
                isTie && 'text-slate-400'
              )}
            >
              {order.profitLoss !== undefined ? (
                <>
                  {order.profitLoss > 0 ? '+' : ''}
                  {formatCurrency(order.profitLoss)}
                </>
              ) : (
                'Pending'
              )}
            </span>
          </div>
        </div>

        <Badge status={order.result || order.status} size="md" dot>
          {order.result || order.status}
        </Badge>
      </div>
    </div>
  );
};
