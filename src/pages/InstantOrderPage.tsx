import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, NavLink } from 'react-router-dom';
import {
  getOrderConfig,
  getMarkets,
  createOrder,
  getOrders,
  cancelOrder,
  getWallet,
} from '../api';
import {
  OrderConfig,
  MarketAsset,
  TrainingOrder,
  OrderDirection,
  WalletBalance,
} from '../types';
import { ActiveOrderCard } from '../components/orders/ActiveOrderCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import {
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Clock,
  Wallet,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useVisibility } from '../lib/useVisibility';

export const InstantOrderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPair = searchParams.get('pair') || 'BTC/USDT';

  const [config, setConfig] = useState<OrderConfig | null>(null);
  const [markets, setMarkets] = useState<MarketAsset[]>([]);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [activeOrders, setActiveOrders] = useState<TrainingOrder[]>([]);

  const [selectedPair, setSelectedPair] = useState<string>(initialPair);
  const [direction, setDirection] = useState<OrderDirection>('CALL');
  const [amount, setAmount] = useState<number>(500);
  const [duration, setDuration] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const { showToast } = useToast();
  const navigate = useNavigate();
  const isVisible = useVisibility();

  // Load configuration and active orders
  const loadOrderData = async () => {
    try {
      const [orderConfig, marketData, walletData, orderList] = await Promise.all([
        getOrderConfig(),
        getMarkets(),
        getWallet(),
        getOrders(),
      ]);

      setConfig(orderConfig);
      setMarkets(marketData);
      setWallet(walletData);
      setActiveOrders(orderList.filter(o => o.status === 'ACTIVE'));
      if (orderConfig.durations.length > 0 && !orderConfig.durations.includes(duration)) {
        setDuration(orderConfig.defaultDuration || 60);
      }
    } catch (err: any) {
      console.warn('Load order config error:', err);
    }
  };

  useEffect(() => {
    loadOrderData();
  }, []);

  // Poll only while an active order exists and tab is visible
  useEffect(() => {
    if (!isVisible || activeOrders.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const [orderList, marketData, walletData] = await Promise.all([
          getOrders(),
          getMarkets(),
          getWallet(),
        ]);
        setActiveOrders(orderList.filter(o => o.status === 'ACTIVE'));
        setMarkets(marketData);
        setWallet(walletData);
      } catch (err) {
        console.warn('Active order poll error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isVisible, activeOrders.length]);

  const currentAsset = useMemo(() => {
    return markets.find(m => m.symbol === selectedPair) || markets[0];
  }, [markets, selectedPair]);

  const payoutPct = config?.payoutPercentages[selectedPair] || 85;
  const potentialPayout = +(amount * (1 + payoutPct / 100)).toFixed(2);
  const potentialProfit = +(potentialPayout - amount).toFixed(2);

  const handleOrderSubmit = async () => {
    setErrorMsg('');
    if (!wallet) return;

    if (amount <= 0) {
      setErrorMsg('Please enter a valid simulated order amount.');
      return;
    }

    if (amount > wallet.available) {
      setErrorMsg(
        `Insufficient available programme balance. Available: ${formatCurrency(wallet.available)}`
      );
      return;
    }

    if (config && (amount < config.minAmount || amount > config.maxAmount)) {
      setErrorMsg(`Amount must be between $${config.minAmount} and $${config.maxAmount}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const newOrder = await createOrder({
        pair: selectedPair,
        direction,
        amount,
        duration,
        currency: 'USD',
      });

      showToast(
        'success',
        'Instant Order Placed',
        `${direction} on ${selectedPair} for ${formatCurrency(amount)} (${duration}s)`
      );

      // Refresh local state
      setActiveOrders(prev => [newOrder, ...prev]);
      setWallet(prev =>
        prev
          ? {
              ...prev,
              available: +(prev.available - amount).toFixed(2),
              frozen: +(prev.frozen + amount).toFixed(2),
            }
          : null
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not place simulated order.');
      showToast('error', 'Execution Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelOrder(id);
      showToast('info', 'Order Cancelled', 'Training order has been cancelled and capital returned.');
      loadOrderData();
    } catch (err: any) {
      showToast('error', 'Cancellation Failed', err.message);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Training Programme Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-surface border border-gold-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-gold-400 shrink-0" />
          <div className="text-slate-300">
            <strong className="text-gold-300">INSTITUTIONAL SIMULATION DESK:</strong> Orders placed
            here are training workflows executed in simulated conditions against live L1 market feeds.
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-mono shrink-0">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>Available: <strong className="text-emerald-400">{formatCurrency(wallet?.available || 0)}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Order Desk Input Panel */}
        <div className="lg:col-span-7 space-y-6">
          <Card variant="royal" className="p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400 font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-mono">Instant Order Execution</h3>
                  <p className="text-xs text-slate-400">High-frequency simulated positioning</p>
                </div>
              </div>

              {currentAsset && (
                <div className="text-right font-mono">
                  <span className="text-[10px] uppercase text-slate-400 block">Live Feed Price</span>
                  <span className="text-base font-bold text-slate-100">{formatCurrency(currentAsset.price)}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Asset Pair Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Select Market Asset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {markets.map(m => (
                  <button
                    key={m.symbol}
                    onClick={() => setSelectedPair(m.symbol)}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all font-mono',
                      selectedPair === m.symbol
                        ? 'bg-gold-500/15 border-gold-500/50 text-gold-300 shadow-md shadow-gold-500/5'
                        : 'bg-surface hover:bg-surface-elevated border-border text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <div className="font-bold text-xs">{m.symbol}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{formatCurrency(m.price)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direction Selector (CALL / PUT) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Order Direction
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDirection('CALL')}
                  className={cn(
                    'p-4 rounded-xl border flex items-center justify-center gap-2.5 font-mono font-black text-sm transition-all',
                    direction === 'CALL'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'bg-surface border-border text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                  )}
                >
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  <span>CALL (HIGHER ↑)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDirection('PUT')}
                  className={cn(
                    'p-4 rounded-xl border flex items-center justify-center gap-2.5 font-mono font-black text-sm transition-all',
                    direction === 'PUT'
                      ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/30'
                      : 'bg-surface border-border text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                  )}
                >
                  <ArrowDownRight className="w-5 h-5 text-rose-400" />
                  <span>PUT (LOWER ↓)</span>
                </button>
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Execution Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {(config?.durations || [30, 60, 120, 300, 600]).map(dur => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setDuration(dur)}
                    className={cn(
                      'flex-1 min-w-[60px] py-2.5 px-3 rounded-xl border text-xs font-bold font-mono transition-all',
                      duration === dur
                        ? 'bg-gold-500/20 border-gold-500/50 text-gold-300 shadow-sm'
                        : 'bg-surface border-border text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                    )}
                  >
                    {dur >= 60 ? `${dur / 60}m` : `${dur}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                  Order Amount (USD)
                </label>
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-slate-500">Quick:</span>
                  {[100, 250, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className="px-2 py-0.5 rounded bg-surface border border-border text-slate-400 hover:text-gold-300 hover:border-gold-500/40 text-[11px]"
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                type="number"
                min={config?.minAmount || 50}
                max={config?.maxAmount || 10000}
                step={50}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="text-lg font-bold font-mono"
              />
            </div>

            {/* Payout & Return Summary Card */}
            <div className="p-4 rounded-xl bg-[#0C0F1D] border border-border/80 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Contract Payout Rate</span>
                <span className="font-bold text-gold-400">{payoutPct}%</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Simulated Order Capital</span>
                <span className="font-bold text-slate-200">{formatCurrency(amount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Potential Gross Return</span>
                <span className="font-bold text-emerald-400 text-sm">{formatCurrency(potentialPayout)}</span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-slate-300">
                <span>Potential Profit (Net)</span>
                <span className="font-extrabold text-emerald-400 text-sm">+{formatCurrency(potentialProfit)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              variant="royal"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              onClick={handleOrderSubmit}
              leftIcon={<Zap className="w-5 h-5 text-slate-950" />}
            >
              Submit Simulated Order ({direction} {duration}s)
            </Button>
          </Card>
        </div>

        {/* Right Column: Active Training Orders Monitor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-400" />
              <span>Active Training Orders ({activeOrders.length})</span>
            </h3>
            <NavLink to="/orders" className="text-xs text-gold-400 hover:text-gold-300 font-semibold font-mono">
              View History
            </NavLink>
          </div>

          {activeOrders.length === 0 ? (
            <Card className="p-8 text-center flex flex-col items-center justify-center bg-surface/50 border-dashed border-border/80">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-slate-500 mb-3">
                <Zap className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No Active Orders</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                Place an Instant Order to start your simulated market calibration workflow.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeOrders.map(order => {
                const liveMarket = markets.find(m => m.symbol === order.pair);
                return (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    currentPrice={liveMarket?.price}
                    onCancel={handleCancel}
                    onSettled={() => {
                      loadOrderData();
                      showToast('info', 'Order Settled', `Order #${order.id} expired. Checking results...`);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
