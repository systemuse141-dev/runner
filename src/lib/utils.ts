import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number | undefined | null,
  currency = 'USD',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '$0.00';
  }

  // Handle tiny crypto prices (e.g., $0.00045)
  let maxDigits = maximumFractionDigits;
  let minDigits = minimumFractionDigits;
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    maxDigits = Math.min(6, Math.max(4, -Math.floor(Math.log10(Math.abs(value))) + 2));
    minDigits = 2;
  }

  const symbolMap: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    USDT: '$',
    BTC: '₿',
    ETH: 'Ξ',
  };

  const symbol = symbolMap[currency] || '$';

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(value);

  return `${symbol}${formatted}`;
}

export function formatNumber(
  value: number | undefined | null,
  compact = false,
  fractionDigits = 2
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0';
  }

  if (compact && Math.abs(value) >= 1_000) {
    if (Math.abs(value) >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(fractionDigits) + 'B';
    }
    if (Math.abs(value) >= 1_000_000) {
      return (value / 1_000_000).toFixed(fractionDigits) + 'M';
    }
    if (Math.abs(value) >= 1_000) {
      return (value / 1_000).toFixed(fractionDigits) + 'K';
    }
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number | undefined | null, showSign = true): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.00%';
  }
  const prefix = showSign && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatDate(dateString: string | number | Date | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

export function formatTime(dateString: string | number | Date | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '—';
  }
}

export function formatDateTime(dateString: string | number | Date | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '—';
  }
}

export function getStatusBadgeVariant(status: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  const s = status.toUpperCase();
  switch (s) {
    case 'ACTIVE':
    case 'LIVE':
    case 'WON':
    case 'WIN':
    case 'COMPLETED':
    case 'APPROVED':
    case 'VERIFIED':
    case 'OFFICIAL':
    case 'OPTIMAL':
    case 'EXCELLENT':
    case 'BULLISH':
    case 'STRONGLY_BULLISH':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-400',
      };
    case 'IN_PROGRESS':
    case 'PENDING':
    case 'UNDER_REVIEW':
    case 'OPEN':
    case 'DELAYED':
    case 'CACHED':
    case 'NEUTRAL':
    case 'GOOD':
    case 'FAIR':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        dot: 'bg-amber-400',
      };
    case 'LOST':
    case 'LOSE':
    case 'FAILED':
    case 'OVERDUE':
    case 'REJECTED':
    case 'CANCELLED':
    case 'RESTRICTED':
    case 'INACTIVE':
    case 'AT RISK':
    case 'BEARISH':
    case 'STRONGLY_BEARISH':
    case 'UNAVAILABLE':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/20',
        dot: 'bg-rose-400',
      };
    case 'NEW':
    case 'VIP':
    case 'HIGH VALUE':
      return {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500/20',
        dot: 'bg-indigo-400',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/20',
        dot: 'bg-slate-400',
      };
  }
}
