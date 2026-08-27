import React, { useState, useMemo } from 'react';
import { OHLCVPoint } from '../../types';
import { formatCurrency, formatNumber, formatDateTime, cn } from '../../lib/utils';
import { BarChart3, LineChart as LineIcon, Activity, Layers } from 'lucide-react';

interface MarketChartProps {
  data: OHLCVPoint[];
  symbol: string;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  showIndicators?: boolean;
  height?: number;
}

export const MarketChart: React.FC<MarketChartProps> = ({
  data,
  symbol,
  timeframe,
  onTimeframeChange,
  showIndicators = true,
  height = 360,
}) => {
  const [chartType, setChartType] = useState<'candles' | 'area'>('candles');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<{ sma: boolean; ema: boolean; rsi: boolean }>({
    sma: true,
    ema: false,
    rsi: false,
  });

  const timeframes = ['1H', '4H', '1D', '1W', '1M', '3M', '1Y'];

  // Calculations for chart geometry
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { points: [], minPrice: 0, maxPrice: 1, minVol: 0, maxVol: 1, smaPoints: [], emaPoints: [], rsiPoints: [] };

    const minPrice = Math.min(...data.map(d => d.low)) * 0.998;
    const maxPrice = Math.max(...data.map(d => d.high)) * 1.002;
    const maxVol = Math.max(...data.map(d => d.volume)) * 1.2;

    // Calculate SMA (period 5)
    const smaPeriod = 5;
    const smaPoints = data.map((d, i) => {
      if (i < smaPeriod - 1) return null;
      const slice = data.slice(i - smaPeriod + 1, i + 1);
      const avg = slice.reduce((acc, curr) => acc + curr.close, 0) / smaPeriod;
      return avg;
    });

    // Calculate EMA (period 8)
    const emaPeriod = 8;
    const k = 2 / (emaPeriod + 1);
    const emaPoints: (number | null)[] = [];
    let prevEma = data[0]?.close || 0;
    data.forEach((d, i) => {
      if (i === 0) {
        emaPoints.push(prevEma);
      } else {
        const currentEma = d.close * k + prevEma * (1 - k);
        emaPoints.push(currentEma);
        prevEma = currentEma;
      }
    });

    return {
      points: data,
      minPrice,
      maxPrice,
      minVol: 0,
      maxVol: maxVol || 1,
      smaPoints,
      emaPoints,
    };
  }, [data]);

  const activePoint = hoverIndex !== null && chartData.points[hoverIndex]
    ? chartData.points[hoverIndex]
    : chartData.points[chartData.points.length - 1];

  const svgWidth = 800;
  const svgHeight = height;
  const paddingRight = 70;
  const paddingBottom = 30;
  const chartWidth = svgWidth - paddingRight;
  const chartHeight = svgHeight - paddingBottom;

  const priceToY = (price: number) => {
    const range = chartData.maxPrice - chartData.minPrice || 1;
    return chartHeight - ((price - chartData.minPrice) / range) * chartHeight;
  };

  const candleWidth = Math.max(3, (chartWidth / (data.length || 1)) * 0.65);

  // Area chart path
  const areaPath = useMemo(() => {
    if (chartData.points.length < 2) return '';
    const pointsStr = chartData.points
      .map((p, i) => {
        const x = (i / (chartData.points.length - 1)) * chartWidth;
        const y = priceToY(p.close);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' L ');

    return `M 0,${chartHeight} L ${pointsStr} L ${chartWidth},${chartHeight} Z`;
  }, [chartData.points, chartWidth, chartHeight, chartData.minPrice, chartData.maxPrice]);

  const linePath = useMemo(() => {
    if (chartData.points.length < 2) return '';
    return 'M ' + chartData.points
      .map((p, i) => {
        const x = (i / (chartData.points.length - 1)) * chartWidth;
        const y = priceToY(p.close);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' L ');
  }, [chartData.points, chartWidth, chartHeight, chartData.minPrice, chartData.maxPrice]);

  // SMA path
  const smaPath = useMemo(() => {
    if (!activeIndicators.sma || chartData.points.length < 5) return '';
    const valid: string[] = [];
    chartData.smaPoints.forEach((val, i) => {
      if (val !== null) {
        const x = (i / (chartData.points.length - 1)) * chartWidth;
        const y = priceToY(val);
        valid.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    });
    return valid.length > 1 ? 'M ' + valid.join(' L ') : '';
  }, [activeIndicators.sma, chartData.smaPoints, chartWidth, chartHeight, chartData.minPrice, chartData.maxPrice]);

  // EMA path
  const emaPath = useMemo(() => {
    if (!activeIndicators.ema || chartData.points.length < 2) return '';
    return 'M ' + chartData.emaPoints
      .map((val, i) => {
        if (val === null) return '';
        const x = (i / (chartData.points.length - 1)) * chartWidth;
        const y = priceToY(val);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' L ');
  }, [activeIndicators.ema, chartData.emaPoints, chartWidth, chartHeight, chartData.minPrice, chartData.maxPrice]);

  // Price Grid Lines (4 steps)
  const priceGridSteps = 4;
  const priceGrid = useMemo(() => {
    const steps = [];
    const stepVal = (chartData.maxPrice - chartData.minPrice) / priceGridSteps;
    for (let i = 0; i <= priceGridSteps; i++) {
      const val = chartData.minPrice + stepVal * i;
      steps.push({
        price: val,
        y: priceToY(val),
      });
    }
    return steps;
  }, [chartData.minPrice, chartData.maxPrice, chartHeight]);

  return (
    <div className="w-full flex flex-col space-y-4 select-none">
      {/* Top Toolbar: Metrics & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/40 font-mono">
        {/* Active Hover / Current OHLCV Display */}
        {activePoint ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <span className="text-slate-400 font-normal">T:</span>
              <span>{formatDateTime(activePoint.timestamp)}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-slate-500">O:</span>
              <span>{formatCurrency(activePoint.open)}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <span className="text-slate-500">H:</span>
              <span>{formatCurrency(activePoint.high)}</span>
            </div>
            <div className="flex items-center gap-1 text-rose-400">
              <span className="text-slate-500">L:</span>
              <span>{formatCurrency(activePoint.low)}</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-slate-100">
              <span className="text-slate-500">C:</span>
              <span className={activePoint.close >= activePoint.open ? 'text-emerald-400' : 'text-rose-400'}>
                {formatCurrency(activePoint.close)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-slate-500">Vol:</span>
              <span>{formatNumber(activePoint.volume, true)}</span>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Chart View Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Chart Type Toggle */}
          <div className="flex items-center bg-surface-elevated rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setChartType('candles')}
              title="Candlestick Chart"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                chartType === 'candles' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('area')}
              title="Area Line Chart"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                chartType === 'area' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LineIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Indicator Toggles */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveIndicators(prev => ({ ...prev, sma: !prev.sma }))}
              className={cn(
                'px-2 py-1 text-[11px] rounded-lg border font-mono transition-colors',
                activeIndicators.sma
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-surface border-border text-slate-500 hover:text-slate-300'
              )}
            >
              SMA(5)
            </button>
            <button
              onClick={() => setActiveIndicators(prev => ({ ...prev, ema: !prev.ema }))}
              className={cn(
                'px-2 py-1 text-[11px] rounded-lg border font-mono transition-colors',
                activeIndicators.ema
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'bg-surface border-border text-slate-500 hover:text-slate-300'
              )}
            >
              EMA(8)
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart Surface */}
      <div className="relative w-full overflow-hidden bg-[#0A0D18] rounded-xl border border-border/60 p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width * svgWidth;
            if (relX <= chartWidth && chartData.points.length > 0) {
              const idx = Math.min(
                chartData.points.length - 1,
                Math.max(0, Math.round((relX / chartWidth) * (chartData.points.length - 1)))
              );
              setHoverIndex(idx);
            }
          }}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {priceGrid.map((grid, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={grid.y}
                x2={chartWidth}
                y2={grid.y}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth + 8}
                y={grid.y + 4}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatCurrency(grid.price)}
              </text>
            </g>
          ))}

          {/* Volume bars behind price */}
          {chartData.points.map((p, i) => {
            const x = (i / (chartData.points.length - 1)) * chartWidth;
            const volHeight = (p.volume / chartData.maxVol) * (chartHeight * 0.25);
            const isUp = p.close >= p.open;
            return (
              <rect
                key={`vol-${i}`}
                x={x - candleWidth / 2}
                y={chartHeight - volHeight}
                width={candleWidth}
                height={volHeight}
                fill={isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}
                rx={1}
              />
            );
          })}

          {/* Candlesticks */}
          {chartType === 'candles' &&
            chartData.points.map((p, i) => {
              const x = (i / (chartData.points.length - 1)) * chartWidth;
              const yOpen = priceToY(p.open);
              const yClose = priceToY(p.close);
              const yHigh = priceToY(p.high);
              const yLow = priceToY(p.low);
              const isUp = p.close >= p.open;
              const candleColor = isUp ? '#10B981' : '#F43F5E';
              const topY = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

              return (
                <g key={`candle-${i}`}>
                  {/* Wick */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth="1.2"
                  />
                  {/* Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={topY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={isUp ? candleColor : candleColor}
                    rx={1.5}
                  />
                </g>
              );
            })}

          {/* Area Chart Mode */}
          {chartType === 'area' && (
            <>
              <path d={areaPath} fill="url(#chartGradient)" />
              <path
                d={linePath}
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Indicator Overlays */}
          {activeIndicators.sma && smaPath && (
            <path
              d={smaPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.9"
            />
          )}

          {activeIndicators.ema && emaPath && (
            <path
              d={emaPath}
              fill="none"
              stroke="#06B6D4"
              strokeWidth="1.5"
              opacity="0.9"
            />
          )}

          {/* Hover Crosshair & Pointer */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={(hoverIndex / (chartData.points.length - 1)) * chartWidth}
                y1={0}
                x2={(hoverIndex / (chartData.points.length - 1)) * chartWidth}
                y2={chartHeight}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                y1={priceToY(chartData.points[hoverIndex].close)}
                x2={chartWidth}
                y2={priceToY(chartData.points[hoverIndex].close)}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeDasharray="3 3"
              />
              <circle
                cx={(hoverIndex / (chartData.points.length - 1)) * chartWidth}
                cy={priceToY(chartData.points[hoverIndex].close)}
                r="4"
                fill="#FFFFFF"
                stroke="#6366F1"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Bottom Timeframe Selector Toolbar */}
      <div className="flex items-center justify-between gap-2 pt-1 font-mono">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                timeframe === tf
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface-elevated text-slate-400 hover:text-slate-200 border border-border'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 hidden sm:block">
          Feed: <span className="text-slate-400 font-medium">L1 Institutional Matching Engine</span>
        </div>
      </div>
    </div>
  );
};
