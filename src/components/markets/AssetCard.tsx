import React from 'react';
import { MarketAsset } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MiniSparkline } from '../charts/MiniSparkline';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AssetCardProps {
  asset: MarketAsset;
  isSelected?: boolean;
  onClick?: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, isSelected, onClick }) => {
  const isUp = asset.change24h >= 0;

  return (
    <Card
      variant={isSelected ? 'elevated' : 'default'}
      onClick={onClick}
      className={`p-4 sm:p-5 transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-indigo-500/60 bg-surface-elevated shadow-lg shadow-indigo-500/10'
          : 'hover:border-white/20 hover:bg-surface-elevated/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border flex items-center justify-center font-bold text-xs text-indigo-300 font-mono">
            {asset.symbol.split('/')[0].slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-slate-100">{asset.symbol}</h4>
              <span className="text-[10px] text-slate-500 font-mono">#{asset.rank}</span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[110px]">{asset.name}</p>
          </div>
        </div>

        <Badge status={asset.dataStatus} size="sm" dot>
          {asset.dataStatus}
        </Badge>
      </div>

      {/* Price & 24h Change */}
      <div className="flex items-baseline justify-between gap-2 my-2 font-mono">
        <div className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight">
          {formatCurrency(asset.price)}
        </div>
        <div
          className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-md ${
            isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(asset.change24h)}
        </div>
      </div>

      {/* Sparkline */}
      <div className="my-3 flex justify-center">
        <MiniSparkline data={asset.sparkline} isPositive={isUp} width={220} height={36} />
      </div>

      {/* Metrics Footer */}
      <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div>
          <span className="text-slate-500">24h Vol: </span>
          <span>{formatNumber(asset.volume24h, true)}</span>
        </div>
        <div>
          <span className="text-slate-500">24h High: </span>
          <span className="text-slate-300">{formatCurrency(asset.high24h)}</span>
        </div>
      </div>
    </Card>
  );
};
