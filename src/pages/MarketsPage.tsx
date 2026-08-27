import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { AssetCard } from '../components/markets/AssetCard';
import { DataTable, Column } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { MarketAsset } from '../types';
import { formatCurrency, formatPercent, formatNumber, cn } from '../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Search,
  LayoutGrid,
  List,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const MarketsPage: React.FC = () => {
  const { markets, dataStatus, lastUpdated } = useMarket();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredMarkets = useMemo(() => {
    return markets.filter(asset => {
      const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
      const matchesSearch =
        asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [markets, categoryFilter, searchQuery]);

  // Market stats
  const topGainer = useMemo(() => {
    return [...markets].sort((a, b) => b.change24h - a.change24h)[0];
  }, [markets]);

  const topLoser = useMemo(() => {
    return [...markets].sort((a, b) => a.change24h - b.change24h)[0];
  }, [markets]);

  const mostVolatile = useMemo(() => {
    return [...markets].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))[0];
  }, [markets]);

  const columns: Column<MarketAsset>[] = [
    {
      key: 'rank',
      header: '#',
      align: 'left',
      className: 'w-12 text-slate-500 font-mono',
      render: asset => `#${asset.rank}`,
    },
    {
      key: 'symbol',
      header: 'Asset',
      render: asset => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#161B30] border border-border flex items-center justify-center font-bold text-xs text-gold-400 font-mono">
            {asset.symbol.split('/')[0].slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-100">
              <span>{asset.symbol}</span>
              <span className="text-[10px] text-slate-500 font-normal uppercase">{asset.category}</span>
            </div>
            <p className="text-xs text-slate-400 font-sans">{asset.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Market Price',
      align: 'right',
      className: 'font-bold text-slate-100',
      render: asset => formatCurrency(asset.price),
    },
    {
      key: 'change24h',
      header: '24h Change',
      align: 'right',
      render: asset => {
        const isUp = asset.change24h >= 0;
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs',
              isUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
            )}
          >
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {formatPercent(asset.change24h)}
          </span>
        );
      },
    },
    {
      key: 'volume24h',
      header: '24h Volume',
      align: 'right',
      className: 'text-slate-300 font-mono',
      render: asset => formatNumber(asset.volume24h, true),
    },
    {
      key: 'marketCap',
      header: 'Market Cap',
      align: 'right',
      className: 'text-slate-300 font-mono hidden md:table-cell',
      render: asset => (asset.marketCap > 0 ? formatNumber(asset.marketCap, true) : '—'),
    },
    {
      key: 'dataStatus',
      header: 'Feed Status',
      align: 'center',
      className: 'hidden lg:table-cell',
      render: asset => (
        <Badge status={asset.dataStatus} size="sm" dot>
          {asset.dataStatus}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Execution',
      align: 'right',
      render: asset => (
        <Button
          size="sm"
          variant="gold"
          className="text-xs h-8 px-3"
          onClick={e => {
            e.stopPropagation();
            navigate(`/instant-order?pair=${encodeURIComponent(asset.symbol)}`);
          }}
          leftIcon={<Zap className="w-3 h-3 text-gold-400" />}
        >
          Train
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">Live Markets Terminal</h2>
            <Badge status={dataStatus} size="sm" dot>
              {dataStatus} SOURCE
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time aggregate market data from global institutional matching feeds
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>Last Updated: <strong className="text-slate-200">{new Date(lastUpdated).toLocaleTimeString()}</strong></span>
        </div>
      </div>

      {/* Highlights: Top Gainer, Top Loser, Trending */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {topGainer && (
          <Card
            className="p-4 bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer font-mono"
            onClick={() => navigate(`/markets/${encodeURIComponent(topGainer.symbol)}`)}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-emerald-400 font-bold flex items-center gap-1 font-sans">
                <TrendingUp className="w-3.5 h-3.5" /> Top Gainer (24h)
              </span>
              <span className="text-slate-500">#{topGainer.rank}</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-lg font-black text-slate-100">{topGainer.symbol}</span>
              <span className="text-base font-bold text-emerald-400">{formatPercent(topGainer.change24h)}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">{formatCurrency(topGainer.price)}</div>
          </Card>
        )}

        {topLoser && (
          <Card
            className="p-4 bg-rose-950/10 border-rose-500/20 hover:border-rose-500/40 cursor-pointer font-mono"
            onClick={() => navigate(`/markets/${encodeURIComponent(topLoser.symbol)}`)}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-rose-400 font-bold flex items-center gap-1 font-sans">
                <TrendingDown className="w-3.5 h-3.5" /> Top Loser (24h)
              </span>
              <span className="text-slate-500">#{topLoser.rank}</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-lg font-black text-slate-100">{topLoser.symbol}</span>
              <span className="text-base font-bold text-rose-400">{formatPercent(topLoser.change24h)}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">{formatCurrency(topLoser.price)}</div>
          </Card>
        )}

        {mostVolatile && (
          <Card
            className="p-4 bg-gold-950/10 border-gold-500/20 hover:border-gold-500/40 cursor-pointer font-mono"
            onClick={() => navigate(`/markets/${encodeURIComponent(mostVolatile.symbol)}`)}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gold-400 font-bold flex items-center gap-1 font-sans">
                <Flame className="w-3.5 h-3.5" /> Most Volatile (24h)
              </span>
              <span className="text-slate-500">#{mostVolatile.rank}</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-lg font-black text-slate-100">{mostVolatile.symbol}</span>
              <span className="text-base font-bold text-gold-400">{formatPercent(mostVolatile.change24h)}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">{formatCurrency(mostVolatile.price)}</div>
          </Card>
        )}
      </div>

      {/* Controls: Search, Category Tabs, View Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Assets' },
            { id: 'crypto', label: 'Crypto' },
            { id: 'forex', label: 'Forex' },
            { id: 'commodities', label: 'Commodities' },
          ]}
          activeTab={categoryFilter}
          onChange={setCategoryFilter}
          variant="segmented"
          className="max-w-md"
        />

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search symbol or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
            className="w-full sm:w-60 h-10 text-xs"
          />

          <div className="flex items-center bg-surface border border-border rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                viewMode === 'table' ? 'bg-gold-500/20 text-gold-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              )}
              aria-label="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                viewMode === 'grid' ? 'bg-gold-500/20 text-gold-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              )}
              aria-label="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Data Render: Grid or Table */}
      {viewMode === 'table' ? (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredMarkets}
            keyExtractor={item => item.symbol}
            onRowClick={item => navigate(`/markets/${encodeURIComponent(item.symbol)}`)}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map(asset => (
            <AssetCard
              key={asset.symbol}
              asset={asset}
              onClick={() => navigate(`/markets/${encodeURIComponent(asset.symbol)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
