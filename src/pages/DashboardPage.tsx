import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Wallet,
  CheckCircle2,
  Clock,
  Award,
  Zap,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  LifeBuoy,
  FileText,
  Activity,
  Layers,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MoneyFlowChart } from '../components/charts/MoneyFlowChart';
import { MiniSparkline } from '../components/charts/MiniSparkline';
import {
  getUserAccountSnapshot,
  getMarkets,
  getMoneyFlow,
  getOrders,
  getTasks,
} from '../api';
import {
  WalletBalance,
  UserProfile,
  MarketAsset,
  MoneyFlowPoint,
  TrainingOrder,
  StudentTask,
} from '../types';
import { formatCurrency, formatPercent, formatDate, formatDateTime, cn } from '../lib/utils';
import { useVisibility } from '../lib/useVisibility';

export const DashboardPage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [markets, setMarkets] = useState<MarketAsset[]>([]);
  const [moneyFlow, setMoneyFlow] = useState<MoneyFlowPoint[]>([]);
  const [recentOrders, setRecentOrders] = useState<TrainingOrder[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isVisible = useVisibility();

  const loadDashboardData = async () => {
    try {
      const [snapshot, marketData, flowData, orderList, taskList] = await Promise.all([
        getUserAccountSnapshot(),
        getMarkets(),
        getMoneyFlow(),
        getOrders(),
        getTasks(),
      ]);

      setProfile(snapshot.profile);
      setWallet(snapshot.wallet);
      setMarkets(marketData.slice(0, 5));
      setMoneyFlow(flowData);
      setRecentOrders(orderList.slice(0, 4));
      setTasks(taskList);
      setActiveOrdersCount(snapshot.activeOrdersCount);
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Soft refresh when tab becomes visible
  useEffect(() => {
    if (isVisible) {
      loadDashboardData();
    }
  }, [isVisible]);

  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Institutional Training Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#12162B] via-[#161B33] to-[#0D1020] border border-gold-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold-400 font-mono px-2 py-0.5 rounded bg-gold-500/10 border border-gold-500/20">
              ROYAL INSTITUTIONAL DESK
            </span>
            <Badge status={profile?.accountStatus || 'Active'} size="sm" dot>
              {profile?.accountStatus || 'Active'}
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Welcome back, {profile?.name || 'Alexander Wright'}
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Curriculum: <span className="text-slate-200 font-semibold">{profile?.currentStage || 'Stage 3: Instant Execution & Risk Calibration'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink to="/instant-order">
            <Button variant="royal" size="md" leftIcon={<Zap className="w-4 h-4 text-slate-950" />}>
              Simulated Instant Order
            </Button>
          </NavLink>
          <NavLink to="/tasks">
            <Button variant="gold" size="md" leftIcon={<Award className="w-4 h-4 text-gold-400" />}>
              View Tasks
            </Button>
          </NavLink>
        </div>
      </div>

      {/* Row 1: Primary Capital & Credit Score StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Programme Balance"
          value={formatCurrency(wallet?.total || 24500)}
          subtitle="Institution-managed training capital"
          icon={<Wallet className="w-5 h-5" />}
          accent="gold"
          trend={{ value: '+$4,500.00', isPositive: true, label: 'Stage 3' }}
          tooltip="Total simulated allocation provided by Mudrexx Academy."
        />

        <StatCard
          title="Available to Execute"
          value={formatCurrency(wallet?.available || 18250)}
          subtitle="Unencumbered simulated balance"
          icon={<Zap className="w-5 h-5" />}
          accent="emerald"
          badge={<span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">READY</span>}
          tooltip="Funds currently free to place simulated instant orders."
        />

        <StatCard
          title="Frozen in Orders"
          value={formatCurrency(wallet?.frozen || 6250)}
          subtitle="Active risk exposure in market"
          icon={<Clock className="w-5 h-5" />}
          accent="royal"
          trend={{ value: `${activeOrdersCount} Open`, isPositive: true }}
          tooltip="Simulated capital locked in active training orders until expiry."
        />

        <StatCard
          title="Credit Rating Score"
          value={`${wallet?.creditScore || 785}`}
          subtitle="Status: Optimal Standing"
          icon={<Sparkles className="w-5 h-5" />}
          accent="gold"
          trend={{ value: '+15 pts', isPositive: true, label: 'Risk Rating' }}
          tooltip="Institutional credit standing evaluated from risk discipline and task completion."
        />
      </div>

      {/* Row 2: Operational Status StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-surface hover:border-gold-500/30 transition-all font-mono">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Orders</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-100">{activeOrdersCount}</span>
            <span className="text-[11px] text-gold-400">In Simulation</span>
          </div>
        </Card>

        <Card className="p-4 bg-surface hover:border-gold-500/30 transition-all font-mono">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Tasks Due</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-amber-400">{pendingTasks}</span>
            <span className="text-[11px] text-slate-400">Action Required</span>
          </div>
        </Card>

        <Card className="p-4 bg-surface hover:border-gold-500/30 transition-all font-mono">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed Modules</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-emerald-400">{completedTasks}</span>
            <span className="text-[11px] text-emerald-400 font-semibold">{progressPercent}%</span>
          </div>
        </Card>

        <Card className="p-4 bg-surface hover:border-gold-500/30 transition-all font-mono">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Support Inquiries</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-100">2</span>
            <span className="text-[11px] text-slate-400">1 Under Review</span>
          </div>
        </Card>
      </div>

      {/* Row 3: Money Flow Chart & Live Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Money Flow Chart */}
        <div className="lg:col-span-7">
          <Card className="p-5 sm:p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-gold-400" />
                    <span>Personal Money Flow</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Simulated training credits, debits, and order volume history
                  </p>
                </div>
                <Badge status="LIVE" size="sm" dot>
                  SYNCED
                </Badge>
              </div>

              <div className="py-4">
                <MoneyFlowChart data={moneyFlow} height={230} />
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Accounting Ledger: Verified</span>
              <NavLink to="/wallet" className="text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1">
                Full Ledger <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </Card>
        </div>

        {/* Live Market Overview */}
        <div className="lg:col-span-5">
          <Card className="p-5 sm:p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Live Market Feeds</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Authentic external L1 aggregate prices
                  </p>
                </div>
                <Badge status="LIVE" size="sm" dot>
                  LIVE
                </Badge>
              </div>

              <div className="divide-y divide-border/40 font-mono my-2">
                {markets.map(asset => {
                  const isUp = asset.change24h >= 0;
                  return (
                    <NavLink
                      key={asset.symbol}
                      to={`/markets/${encodeURIComponent(asset.symbol)}`}
                      className="py-3 flex items-center justify-between hover:bg-white/5 px-2 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-xs font-bold text-gold-300">
                          {asset.symbol.split('/')[0].slice(0, 3)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-200 group-hover:text-gold-400 transition-colors text-sm">
                            {asset.symbol}
                          </span>
                          <span className="text-[10px] text-slate-500 block">{asset.name}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-slate-100 text-sm">{formatCurrency(asset.price)}</div>
                        <div className={cn('text-xs font-semibold', isUp ? 'text-emerald-400' : 'text-rose-400')}>
                          {formatPercent(asset.change24h)}
                        </div>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Feed Provider: Interbank L1</span>
              <NavLink to="/markets" className="text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1">
                Open Terminal <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 4: Curriculum Progress & Recent Execution Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Personal Progress */}
        <div className="lg:col-span-4">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-gold-400" />
                <span>Curriculum Progress</span>
              </h3>
              <span className="text-xs font-mono font-bold text-gold-400">{progressPercent}%</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Completed Tasks</span>
                <span className="text-slate-200 font-bold">{completedTasks} of {tasks.length}</span>
              </div>
              <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-500 to-gold-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Upcoming Priority Task */}
            {tasks.find(t => t.status !== 'COMPLETED') && (
              <div className="p-3.5 rounded-xl bg-surface-elevated/80 border border-gold-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-gold-400 font-mono">Next Priority Task</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Due {formatDate(tasks.find(t => t.status !== 'COMPLETED')?.dueDate)}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">
                  {tasks.find(t => t.status !== 'COMPLETED')?.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {tasks.find(t => t.status !== 'COMPLETED')?.description}
                </p>
                <NavLink to="/tasks" className="block pt-1">
                  <Button variant="outline" size="sm" className="w-full text-xs h-7 text-gold-300 border-gold-500/30">
                    Open Task Workspace
                  </Button>
                </NavLink>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Execution Activity */}
        <div className="lg:col-span-8">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Recent Execution History</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest simulated Instant Orders and settlement outcomes
                </p>
              </div>
              <NavLink to="/orders">
                <Button variant="ghost" size="sm" className="text-xs text-gold-400">
                  View All Orders
                </Button>
              </NavLink>
            </div>

            <div className="space-y-2.5 font-mono">
              {recentOrders.map(ord => {
                const isWin = ord.result === 'WIN';
                const isLose = ord.result === 'LOSE';
                return (
                  <div
                    key={ord.id}
                    className="p-3 rounded-xl bg-surface-elevated/60 border border-border/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center font-bold text-gold-400 border border-border">
                        {ord.direction === 'CALL' ? '↑' : '↓'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-200">
                          <span>{ord.pair}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({ord.duration}s)</span>
                        </div>
                        <span className="text-[10px] text-slate-500">#{ord.id}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-slate-200">{formatCurrency(ord.amount)}</div>
                      <div
                        className={cn(
                          'text-[11px] font-bold',
                          isWin ? 'text-emerald-400' : isLose ? 'text-rose-400' : 'text-slate-400'
                        )}
                      >
                        {ord.profitLoss !== undefined ? (
                          <>
                            {ord.profitLoss > 0 ? '+' : ''}
                            {formatCurrency(ord.profitLoss)}
                          </>
                        ) : (
                          'Active'
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
