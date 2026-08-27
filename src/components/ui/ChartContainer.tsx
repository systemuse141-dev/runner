import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge } from './Badge';
import { cn } from '../../lib/utils';
import { MarketDataStatus } from '../../types';

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  status?: MarketDataStatus;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  status,
  toolbar,
  children,
  footer,
  className,
  badge,
}) => {
  return (
    <Card className={cn('overflow-hidden flex flex-col', className)}>
      <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {status && (
              <Badge status={status} size="sm" dot>
                {status}
              </Badge>
            )}
            {badge}
          </div>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>

        {toolbar && <div className="flex items-center gap-2 flex-wrap">{toolbar}</div>}
      </CardHeader>

      <CardContent className="p-4 sm:p-6 flex-1 min-h-[260px] flex flex-col">
        {children}
      </CardContent>

      {footer && <div className="p-4 bg-surface-elevated/40 border-t border-border/40 text-xs text-slate-400">{footer}</div>}
    </Card>
  );
};
