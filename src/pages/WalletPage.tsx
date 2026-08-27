import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWallet, getWalletTransactions, createWithdrawalSupport } from '../api';
import { WalletBalance, WalletTransaction } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { DataTable, Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime, cn } from '../lib/utils';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  Clock,
  Sparkles,
  HelpCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [withdrawCurrency, setWithdrawCurrency] = useState('USD');
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const { showToast } = useToast();
  const navigate = useNavigate();

  const loadWalletData = async () => {
    try {
      const [walletData, txData] = await Promise.all([
        getWallet(),
        getWalletTransactions(),
      ]);
      setWallet(walletData);
      setTransactions(txData);
    } catch (err) {
      console.warn('Wallet data fetch error:', err);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');

    if (!wallet) return;

    if (withdrawAmount <= 0) {
      setWithdrawError('Please enter a valid withdrawal request amount.');
      return;
    }

    if (withdrawAmount > wallet.available) {
      setWithdrawError(
        `Requested amount (${formatCurrency(withdrawAmount)}) exceeds available balance (${formatCurrency(wallet.available)}).`
      );
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const ticket = await createWithdrawalSupport({
        amount: withdrawAmount,
        currency: withdrawCurrency,
        message: withdrawMessage || 'Student withdrawal request from verified performance allocation.',
      });

      showToast(
        'success',
        'Withdrawal Request Submitted',
        `Request #${ticket.id} has been routed to institutional compliance review.`
      );

      setIsWithdrawModalOpen(false);
      loadWalletData();
      navigate('/support');
    } catch (err: any) {
      setWithdrawError(err.message || 'Failed to submit withdrawal request.');
      showToast('error', 'Request Failed', err.message);
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const columns: Column<WalletTransaction>[] = [
    {
      key: 'id',
      header: 'Reference ID',
      className: 'font-mono text-xs text-slate-400',
      render: tx => `#${tx.id}`,
    },
    {
      key: 'date',
      header: 'Timestamp',
      className: 'text-xs text-slate-400 font-mono',
      render: tx => formatDateTime(tx.date),
    },
    {
      key: 'type',
      header: 'Transaction Type',
      render: tx => {
        const isPositive = tx.amount >= 0;
        return (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs',
                isPositive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              )}
            >
              {isPositive ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
            </div>
            <div>
              <span className="font-bold text-slate-200 text-xs">{tx.description}</span>
              <span className="text-[10px] text-slate-500 block font-mono uppercase">{tx.type.replace('_', ' ')}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: tx => {
        const isPositive = tx.amount >= 0;
        return (
          <span
            className={cn(
              'font-black font-mono text-sm',
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {isPositive ? '+' : ''}
            {formatCurrency(tx.amount, tx.currency)}
          </span>
        );
      },
    },
    {
      key: 'afterBalance',
      header: 'Balance After',
      align: 'right',
      className: 'font-mono text-xs text-slate-300 font-semibold',
      render: tx => formatCurrency(tx.afterBalance, tx.currency),
    },
    {
      key: 'status',
      header: 'Audit Status',
      align: 'center',
      render: tx => (
        <Badge status={tx.status} size="sm" dot>
          {tx.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Top Banner & Quick Withdrawal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gold-400" />
              <span>Institutional Capital &amp; Ledger</span>
            </h2>
            <Badge status="OPTIMAL" size="sm" dot>
              OPTIMAL STANDING
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Institution-managed student balances, risk allocations, and compliance review ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="royal"
            size="md"
            onClick={() => setIsWithdrawModalOpen(true)}
            leftIcon={<ArrowUpRight className="w-4 h-4 text-slate-950" />}
          >
            Request Withdrawal
          </Button>
        </div>
      </div>

      {/* Primary Balance StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Total Programme Balance"
          value={formatCurrency(wallet?.total || 24500)}
          subtitle="Simulated training capital allocation"
          icon={<Wallet className="w-5 h-5" />}
          accent="gold"
          trend={{ value: '+$4,500.00', isPositive: true, label: 'Stage Growth' }}
          tooltip="Includes available capital and currently frozen order exposure."
        />

        <StatCard
          title="Available Balance"
          value={formatCurrency(wallet?.available || 18250)}
          subtitle="Unencumbered simulated balance"
          icon={<ArrowDownLeft className="w-5 h-5" />}
          accent="emerald"
          badge={<span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">READY</span>}
          tooltip="Funds currently free for instant order execution or performance withdrawal."
        />

        <StatCard
          title="Frozen in Orders"
          value={formatCurrency(wallet?.frozen || 6250)}
          subtitle="Active risk exposure in market"
          icon={<Lock className="w-5 h-5" />}
          accent="royal"
          tooltip="Allocated capital locked in open simulated contracts."
        />

        <StatCard
          title="Pending Withdrawals"
          value={formatCurrency(wallet?.pending || 0)}
          subtitle="Under compliance desk review"
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
          tooltip="Withdrawal requests currently under compliance audit."
        />
      </div>

      {/* Credit Standing & Institutional Governance Card */}
      <Card variant="royal" className="p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400 font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">Credit Score: {wallet?.creditScore || 785} / 850</h3>
              <Badge status="EXCELLENT" size="sm" dot>
                {wallet?.creditStatus || 'OPTIMAL'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Unrestricted Institutional Access • High drawdown tolerance • Tier-1 Execution Speed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/documents')}
            leftIcon={<FileText className="w-4 h-4 text-gold-400" />}
            className="text-xs"
          >
            Download Account Statement
          </Button>
        </div>
      </Card>

      {/* Transaction History Ledger */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-slate-100">Accounting Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified simulated transaction history and reward distributions
            </p>
          </div>
          <Badge status="LIVE" size="sm" dot>
            AUDITED
          </Badge>
        </div>

        <DataTable
          columns={columns}
          data={transactions}
          keyExtractor={item => item.id}
        />
      </Card>

      {/* Withdrawal Request Modal */}
      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Institutional Performance Withdrawal Request"
        description="Withdrawal requests from simulated trading performance are routed to the Compliance Desk."
        maxWidth="md"
      >
        <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
          {withdrawError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{withdrawError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-[#0C0F1D] border border-border/80 space-y-1 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Available for Withdrawal:</span>
              <span className="font-bold text-emerald-400">{formatCurrency(wallet?.available || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Compliance Fee:</span>
              <span className="font-bold text-slate-200">$0.00 (Waived)</span>
            </div>
          </div>

          <Input
            label="Requested Amount (USD)"
            type="number"
            min={100}
            max={wallet?.available || 10000}
            step={50}
            value={withdrawAmount}
            onChange={e => setWithdrawAmount(Number(e.target.value))}
            required
            className="font-mono font-bold text-base"
          />

          <Select
            label="Settlement Currency"
            value={withdrawCurrency}
            onChange={e => setWithdrawCurrency(e.target.value)}
            options={[
              { value: 'USD', label: 'USD — Institutional Settlement Wire' },
              { value: 'USDT', label: 'USDT — ERC20 / TRC20 Settlement' },
              { value: 'EUR', label: 'EUR — SEPA Interbank Transfer' },
            ]}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Destination Details / Memo
            </label>
            <textarea
              rows={3}
              value={withdrawMessage}
              onChange={e => setWithdrawMessage(e.target.value)}
              placeholder="Provide registered institutional bank details or settlement wallet address..."
              className="w-full rounded-xl bg-surface border border-border px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500 font-sans"
            />
          </div>

          <div className="p-3 rounded-xl bg-surface border border-border/80 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
            <span>
              Withdrawal requests create an official inquiry with your designated compliance supervisor.
              Audit turnaround is typically 24–48 hours.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsWithdrawModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="royal"
              size="md"
              isLoading={isSubmittingWithdraw}
            >
              Submit Request to Support
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
