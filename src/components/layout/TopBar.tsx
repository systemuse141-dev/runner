import React from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useMarket } from '../../context/MarketContext';
import { Bell, Sparkles, Menu, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface TopBarProps {
  pageTitle: string;
  pageSubtitle?: string;
  onOpenMobileMenu: () => void;
  onOpenNova: () => void;
  unreadNotifsCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  pageTitle,
  pageSubtitle,
  onOpenMobileMenu,
  onOpenNova,
  unreadNotifsCount = 0,
}) => {
  const { user } = useAuth();
  const { dataStatus } = useMarket();

  return (
    <header className="sticky top-0 z-20 h-16 bg-[#090A0F]/85 backdrop-blur-md border-b border-border/80 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-surface border border-border text-slate-400 hover:text-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              {pageTitle}
            </h1>
            {/* Live Data Status Indicator */}
            <Badge status={dataStatus} size="sm" dot className="hidden sm:inline-flex">
              {dataStatus} FEED
            </Badge>
          </div>
          {pageSubtitle && (
            <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md hidden md:block">
              {pageSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Balance Pill, NOVA trigger, Notifications & Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Institutional Verification Indicator */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border/60 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Institutional ID:</span>
          <span className="text-slate-200 font-bold">{user?.id || 'STU-98421'}</span>
        </div>

        {/* NOVA Copilot Quick Trigger */}
        <button
          onClick={onOpenNova}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-600/20 transition-colors text-xs font-semibold font-mono"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">NOVA AI</span>
        </button>

        {/* Notifications Icon Button */}
        <NavLink
          to="/notifications"
          className="relative p-2 rounded-xl bg-surface border border-border text-slate-400 hover:text-slate-100 hover:bg-surface-elevated transition-colors"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-[9px] font-mono font-bold text-white flex items-center justify-center">
              {unreadNotifsCount}
            </span>
          )}
        </NavLink>

        {/* Profile Pill */}
        <NavLink
          to="/profile"
          className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-surface hover:bg-surface-elevated border border-border transition-colors group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-200 leading-tight group-hover:text-indigo-300 transition-colors">
              {user?.name?.split(' ')[0] || 'Alexander'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Score: <span className="text-emerald-400 font-semibold">{user?.creditScore || 785}</span>
            </div>
          </div>
        </NavLink>
      </div>
    </header>
  );
};
