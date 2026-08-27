import React from 'react';
import { MoneyFlowPoint } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface MoneyFlowChartProps {
  data: MoneyFlowPoint[];
  height?: number;
}

export const MoneyFlowChart: React.FC<MoneyFlowChartProps> = ({ data, height = 240 }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-slate-500 py-12">No transaction data available</div>;
  }

  const svgWidth = 600;
  const svgHeight = height;
  const paddingBottom = 25;
  const paddingLeft = 10;
  const paddingRight = 10;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingBottom;

  const maxVal = Math.max(...data.map(d => Math.max(d.credits, d.debits, d.orderMovements))) * 1.25 || 1000;
  const minVal = 0;

  const barGroupWidth = chartWidth / data.length;
  const barWidth = Math.max(4, barGroupWidth * 0.2);

  return (
    <div className="w-full flex flex-col space-y-3 font-mono">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-slate-300">Credits / Grants</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-slate-300">Debits / Losses</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
          <span className="text-slate-300">Order Volume</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full bg-[#0A0D18] rounded-xl border border-border/60 p-2">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
          {/* Grid horizontal lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
            <line
              key={idx}
              x1={paddingLeft}
              y1={chartHeight * (1 - ratio)}
              x2={chartWidth + paddingLeft}
              y2={chartHeight * (1 - ratio)}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="4 4"
            />
          ))}

          {/* Grouped Bars */}
          {data.map((item, idx) => {
            const groupX = paddingLeft + idx * barGroupWidth;
            const creditH = (item.credits / maxVal) * chartHeight;
            const debitH = (item.debits / maxVal) * chartHeight;
            const orderH = (item.orderMovements / maxVal) * chartHeight;

            return (
              <g key={idx}>
                {/* Credits */}
                <rect
                  x={groupX + barGroupWidth * 0.15}
                  y={chartHeight - creditH}
                  width={barWidth}
                  height={creditH}
                  fill="#10B981"
                  rx={2}
                  opacity={0.85}
                />
                {/* Debits */}
                <rect
                  x={groupX + barGroupWidth * 0.15 + barWidth + 2}
                  y={chartHeight - debitH}
                  width={barWidth}
                  height={debitH}
                  fill="#F43F5E"
                  rx={2}
                  opacity={0.85}
                />
                {/* Order Volume */}
                <rect
                  x={groupX + barGroupWidth * 0.15 + (barWidth + 2) * 2}
                  y={chartHeight - orderH}
                  width={barWidth}
                  height={orderH}
                  fill="#6366F1"
                  rx={2}
                  opacity={0.7}
                />

                {/* X-axis Date label */}
                <text
                  x={groupX + barGroupWidth * 0.5}
                  y={svgHeight - 6}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                >
                  {item.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
        <span>* Institutional Training Capital & Simulated Accounting Movement</span>
        <span className="text-indigo-400 font-semibold">Net Stage Growth: +$4,500.00</span>
      </div>
    </div>
  );
};
