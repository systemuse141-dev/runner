import React, { useState, useEffect } from 'react';
import { TrainingOrder } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatCurrency, cn } from '../../lib/utils';
import { Clock, ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle } from 'lucide-react';

interface ActiveOrderCardProps {
  order: TrainingOrder;
  currentPrice?: number;
  onCancel?: (id: string) => void;
  onSettled?: (order: TrainingOrder) => void;
}

export const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({
  order,
  currentPrice,
  onCancel,
  onSettled,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const expires = new Date(order.expiresAt).getTime();
    return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
  });

  const isCall = order.direction === 'CALL' || order.direction === 'BUY';
  const effectiveCurrentPrice = currentPrice || order.currentPrice || order.entryPrice;
  const isWinning = isCall
    ? effectiveCurrentPrice > order.entryPrice
    : effectiveCurrentPrice < order.entryPrice;

  useEffect(() => {
    if (order.status !== 'ACTIVE') return;

    const timer = setInterval(() => {
      const expires = new Date(order.expiresAt).getTime();
      const remaining = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        onSettled?.(order);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [order, onSettled]);

  const progressPercent = Math.max(
    0,
    Math.min(100, ((order.duration - secondsLeft) / order.duration) * 100)
  );

  return (
    <Card
      className={cn(
        'p-5 sm:p-6 border-l-4 transition-all duration-300 relative overflow-hidden',
        isWinning ? 'border-l-emerald-500 bg-emerald-950/5' : 'border-l-rose-500 bg-rose-950/5'
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-100 font-mono">{order.pair}</h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-md font-mono',
                isCall ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              )}
            >
              {isCall ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {order.direction}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Order ID: #{order.id}</p>
        </div>

        <div className="text-right">
          <Badge status={order.status} size="sm" dot>
            {order.status}
          </Badge>
          <div className="flex items-center gap-1 text-xs font-mono text-slate-400 mt-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>{secondsLeft}s left</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Price & Payout Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs mb-4">
        <div className="p-2.5 rounded-xl bg-surface-elevated/70 border border-border/40">
          <span className="text-slate-500 block text-[10px] uppercase">Entry Price</span>
          <span className="font-bold text-slate-200 mt-0.5 block">{formatCurrency(order.entryPrice)}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-surface-elevated/70 border border-border/40">
          <span className="text-slate-500 block text-[10px] uppercase">Current Live Price</span>
          <span
            className={cn(
              'font-bold mt-0.5 block',
              isWinning ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {formatCurrency(effectiveCurrentPrice)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-surface-elevated/70 border border-border/40">
          <span className="text-slate-500 block text-[10px] uppercase">Order Amount</span>
          <span className="font-bold text-slate-200 mt-0.5 block">{formatCurrency(order.amount)}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-surface-elevated/70 border border-border/40">
          <span className="text-slate-500 block text-[10px] uppercase">Potential Payout ({order.payoutPercentage}%)</span>
          <span className="font-bold text-emerald-400 mt-0.5 block">{formatCurrency(order.potentialPayout)}</span>
        </div>
      </div>

      {/* Order Status Indicator Footer */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5 font-mono">
          {isWinning ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              In Profit (+{formatCurrency(order.potentialPayout - order.amount)})
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              <XCircle className="w-3.5 h-3.5" />
              Out of Profit (-{formatCurrency(order.amount)})
            </span>
          )}
        </div>

        {onCancel && order.status === 'ACTIVE' && secondsLeft > 15 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(order.id)}
            className="text-xs text-rose-400 hover:text-rose-300"
          >
            Cancel Order
          </Button>
        )}
      </div>
    </Card>
  );
};
