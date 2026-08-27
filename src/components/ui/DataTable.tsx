import React from 'react';
import { cn } from '../../lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyState,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full space-y-3 p-6 animate-pulse">
        <div className="h-8 bg-surface-elevated rounded-xl w-full" />
        <div className="h-12 bg-surface rounded-xl w-full" />
        <div className="h-12 bg-surface rounded-xl w-full" />
        <div className="h-12 bg-surface rounded-xl w-full" />
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <div className="p-6">{emptyState}</div>;
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-surface-elevated/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn('px-5 py-3.5', alignClasses[col.align || 'left'], col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40 font-mono">
          {data.map((item, idx) => (
            <tr
              key={keyExtractor(item, idx)}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'group transition-colors duration-150',
                onRowClick ? 'cursor-pointer hover:bg-surface-highlight/50' : 'hover:bg-surface-elevated/30'
              )}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cn(
                    'px-5 py-4 text-slate-200 text-sm whitespace-nowrap',
                    alignClasses[col.align || 'left'],
                    col.className
                  )}
                >
                  {col.render ? col.render(item, idx) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
