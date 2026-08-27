import React from 'react';
import { FolderOpen, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 sm:p-12 text-center', className)}>
      <div className="p-4 rounded-2xl bg-surface-elevated border border-border text-slate-400 mb-4">
        {icon || <FolderOpen className="w-8 h-8 stroke-[1.5]" />}
      </div>
      <h4 className="text-base font-semibold text-slate-200 tracking-tight">{title}</h4>
      <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">{description}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Service Unavailable',
  message = 'Unable to synchronize institutional data. Please check connection and try again.',
  onRetry,
  className,
}) => {
  return (
    <Card className={cn('p-8 text-center flex flex-col items-center justify-center border-rose-500/20 bg-rose-950/10', className)}>
      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h4 className="text-base font-semibold text-slate-100">{title}</h4>
      <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-1 mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
          Retry Connection
        </Button>
      )}
    </Card>
  );
};

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading institutional data...',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center space-y-3', className)}>
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      <p className="text-xs font-mono text-slate-400 tracking-wide uppercase">{message}</p>
    </div>
  );
};
