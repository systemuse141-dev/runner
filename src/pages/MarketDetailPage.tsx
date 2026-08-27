import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  getMarketBySymbol,
  getMarketOHLCV,
  getMarketAnalysis,
} from '../api';
import { MarketAsset, OHLCVPoint, TechnicalAnalysis } from '../types';
import { MarketChart } from '../components/charts/MarketChart';
import { TechnicalIndicators } from '../components/markets/TechnicalIndicators';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/EmptyState';
import { formatCurrency, formatPercent, formatNumber, cn } from '../lib/utils';
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Clock,
  Activity,
  Layers,
} from 'lucide-react';
import { useVisibility } from '../lib/useVisibility';

export const MarketDetailPage: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const decodedSymbol = symbol ? decodeURIComponent(symbol) : 'BTC/USDT';
  const navigate = useNavigate();

  const [asset, setAsset] = useState<MarketAsset | null>(null);
  const [ohlcv, setOhlcv] = useState<OHLCVPoint[]>([]);
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1H');
  const [isLoading, setIsLoading] = useState(true);

  const isVisible = useVisibility();

  const fetchAssetDetails = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      const [marketData, ohlcvData, analysisData] = await Promise.all([
        getMarketBySymbol(decodedSymbol),
        getMarketOHLCV(decodedSymbol, timeframe),
        getMarketAnalysis(decodedSymbol),
      ]);
      setAsset(marketData);
      setOhlcv(ohlcvData);
      setAnalysis(analysisData);
    } catch (err) {
      console.warn('Market detail error:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetDetails(true);
  }, [decodedSymbol, timeframe]);

  // Controlled polling only while page is visible
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      fetchAssetDetails(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible, decodedSymbol, timeframe]);

  if (isLoading || !asset) {
    return <LoadingState message={`Connecting to ${decodedSymbol} feed...`} />;
  }

  const isUp = asset.change24h >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button & Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/markets')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="text-xs"
        >
          Back to Markets
        </Button>

        <NavLink to={`/instant-order?pair=${encodeURIComponent(asset.symbol)}`}>
          <Button variant="royal" size="sm" leftIcon={<Zap className="w-4 h-4 text-slate-950" />}>
            Execute Training Order on {asset.symbol}
          </Button>
        </NavLink>
      </div>

      {/* Asset Header Banner */}
      <Card variant="royal" className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#161B30] border border-gold-500/30 flex items-center justify-center font-black text-lg text-gold-400 font-mono shadow-md">
              {asset.symbol.split('/')[0].slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-black text-slate-100 tracking-tight font-mono">
                  {asset.symbol}
                </h2>
                <Badge status={asset.dataStatus} size="sm" dot>
                  {asset.dataStatus}
                </Badge>
                <span className="text-xs text-slate-500 font-mono">Rank #{asset.rank}</span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{asset.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-6 font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Live Price</span>
              <span className="text-3xl font-black text-slate-100">{formatCurrency(asset.price)}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">24h Change</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-base font-extrabold px-2 py-0.5 rounded-md mt-0.5',
                  isUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                )}
              >
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatPercent(asset.change24h)}
              </span>
            </div>

            <div className="hidden sm:block">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">24h Volume</span>
              <span className="text-lg font-bold text-slate-200">{formatNumber(asset.volume24h, true)}</span>
            </div>

            <div className="hidden lg:block">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Market Cap</span>
              <span className="text-lg font-bold text-slate-200">
                {asset.marketCap > 0 ? formatNumber(asset.marketCap, true) : '—'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Terminal Grid: Interactive Chart + Technical Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Chart Container */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-5 sm:p-6">
            <MarketChart
              data={ohlcv}
              symbol={asset.symbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              height={360}
            />
          </Card>

          {/* Market Feed Data Panel */}
          <Card className="p-4 bg-surface-elevated/60 text-xs font-mono text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gold-400" />
              <span>Feed Provider: <strong className="text-slate-200">{asset.source}</strong></span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Last Tick: <strong className="text-slate-300">{new Date(asset.lastUpdated).toLocaleTimeString()}</strong></span>
              <span>Data Status: <strong className="text-emerald-400">{asset.dataStatus}</strong></span>
            </div>
          </Card>
        </div>

        {/* Technical Indicators Panel */}
        <div className="lg:col-span-4 space-y-4">
          {analysis && <TechnicalIndicators analysis={analysis} dataStatus={asset.dataStatus} />}
        </div>
      </div>
    </div>
  );
};
