import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { getOrders } from '../api';
import { TrainingOrder } from '../types';
import { OrderRow } from '../components/orders/OrderRow';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDateTime, cn } from '../lib/utils';
import {
  History,
  Zap,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<TrainingOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      console.warn('Orders fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && ord.status === 'ACTIVE') ||
        (filterStatus === 'win' && ord.result === 'WIN') ||
        (filterStatus === 'lose' && ord.result === 'LOSE') ||
        (filterStatus === 'tie' && ord.result === 'TIE') ||
        (filterStatus === 'cancelled' && ord.status === 'CANCELLED');

      const matchesQuery =
        ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.pair.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesQuery;
    });
  }, [orders, filterStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const wins = orders.filter(o => o.result === 'WIN');
    const losses = orders.filter(o => o.result === 'LOSE');
    const totalSettled = wins.length + losses.length;
    const winRate = totalSettled > 0 ? Math.round((wins.length / totalSettled) * 100) : 0;
    const netProfit = orders.reduce((acc, curr) => acc + (curr.profitLoss || 0), 0);

    return {
      total: orders.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      netProfit,
    };
  }, [orders]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-gold-400" />
              <span>Order Execution Ledger</span>
            </h2>
            <Badge status="VERIFIED" size="sm" dot>
              SETTLED
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative institutional execution log &amp; simulated contract settlements
          </p>
        </div>

        <NavLink to="/instant-order">
          <Button variant="royal" size="sm" leftIcon={<Zap className="w-4 h-4 text-slate-950" />}>
            New Instant Order
          </Button>
        </NavLink>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <Card className="p-4 bg-surface">
          <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Total Executed</span>
          <div className="text-xl font-black text-slate-100 mt-1">{stats.total}</div>
        </Card>

        <Card className="p-4 bg-surface">
          <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Win Rate</span>
          <div className="text-xl font-black text-emerald-400 mt-1">{stats.winRate}%</div>
        </Card>

        <Card className="p-4 bg-surface">
          <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Wins / Losses</span>
          <div className="text-xl font-black text-slate-200 mt-1">
            <span className="text-emerald-400">{stats.wins}</span> / <span className="text-rose-400">{stats.losses}</span>
          </div>
        </Card>

        <Card className="p-4 bg-surface">
          <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Cumulative P&amp;L</span>
          <div
            className={cn(
              'text-xl font-black mt-1',
              stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {stats.netProfit >= 0 ? '+' : ''}
            {formatCurrency(stats.netProfit)}
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All Orders', count: orders.length },
            { id: 'active', label: 'Active', count: orders.filter(o => o.status === 'ACTIVE').length },
            { id: 'win', label: 'Won', count: stats.wins },
            { id: 'lose', label: 'Lost', count: stats.losses },
            { id: 'tie', label: 'Tie', count: orders.filter(o => o.result === 'TIE').length },
            { id: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'CANCELLED').length },
          ]}
          activeTab={filterStatus}
          onChange={setFilterStatus}
          variant="segmented"
          className="max-w-xl"
        />

        <Input
          placeholder="Search by ID or symbol..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          leftElement={<Search className="w-4 h-4" />}
          className="w-full sm:w-60 h-10 text-xs"
        />
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          title="No Orders Found"
          description="There are no simulated orders matching your selected filters."
          action={{
            label: 'Execute First Order',
            onClick: () => (window.location.href = '/instant-order'),
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};
