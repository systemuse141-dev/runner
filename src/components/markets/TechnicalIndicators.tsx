import React from 'react';
import { TechnicalAnalysis, MarketDataStatus } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { Gauge, Compass, Activity, ShieldCheck, Zap } from 'lucide-react';

interface TechnicalIndicatorsProps {
  analysis: TechnicalAnalysis;
  dataStatus?: MarketDataStatus;
}

export const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({
  analysis,
  dataStatus = 'LIVE',
}) => {
  return (
    <div className="space-y-4">
      {/* Primary Signal Overview */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-100">Technical Signal Matrix</h4>
          </div>
          <Badge status={analysis.trend} size="sm" dot>
            {analysis.trend.replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3 rounded-xl bg-surface-elevated/60 border border-border/40">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">RSI (14)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-slate-100 font-mono">{analysis.rsi14.toFixed(1)}</span>
              <span className="text-[10px] text-indigo-400 font-semibold">{analysis.rsiSignal}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-elevated/60 border border-border/40">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">MACD (12,26)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-emerald-400 font-mono">+{analysis.macd.histogram}</span>
              <span className="text-[10px] text-emerald-400 font-semibold">BULL</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-elevated/60 border border-border/40">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Volatility (4H)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-amber-400 font-mono">{formatPercent(analysis.volatility, false)}</span>
              <span className="text-[10px] text-amber-400 font-semibold">MOD</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-elevated/60 border border-border/40">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Momentum</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-indigo-400 font-mono">{analysis.momentum}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Moving Averages & Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Moving Averages */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Moving Averages</h4>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated/40 border border-border/30">
              <span className="text-slate-400">SMA (20-Period)</span>
              <span className="font-semibold text-slate-100">{formatCurrency(analysis.sma20)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated/40 border border-border/30">
              <span className="text-slate-400">SMA (50-Period)</span>
              <span className="font-semibold text-slate-100">{formatCurrency(analysis.sma50)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated/40 border border-border/30">
              <span className="text-slate-400">EMA (12-Period)</span>
              <span className="font-semibold text-cyan-400">{formatCurrency(analysis.ema12)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated/40 border border-border/30">
              <span className="text-slate-400">EMA (26-Period)</span>
              <span className="font-semibold text-cyan-400">{formatCurrency(analysis.ema26)}</span>
            </div>
          </div>
        </Card>

        {/* Support & Resistance */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Key Institutional Levels</h4>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
              <span className="text-rose-300 font-sans">Resistance R2</span>
              <span className="font-bold text-rose-400">{formatCurrency(analysis.resistanceLevels[1])}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
              <span className="text-rose-300 font-sans">Resistance R1</span>
              <span className="font-bold text-rose-400">{formatCurrency(analysis.resistanceLevels[0])}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <span className="text-emerald-300 font-sans">Support S1</span>
              <span className="font-bold text-emerald-400">{formatCurrency(analysis.supportLevels[0])}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <span className="text-emerald-300 font-sans">Support S2</span>
              <span className="font-bold text-emerald-400">{formatCurrency(analysis.supportLevels[1])}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Analysis Summary Note */}
      <div className="p-4 rounded-xl bg-surface border border-border text-xs text-slate-400 flex items-start gap-3">
        <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-slate-200 leading-relaxed font-sans">{analysis.summary}</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 font-mono">
            <span>Source: <strong className="text-slate-400">Institutional Quant Engine</strong></span>
            <span>•</span>
            <span>Status: <strong className="text-emerald-400">{dataStatus}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
