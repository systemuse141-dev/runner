import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  ClipboardList,
  Wallet,
  History,
  FileText,
  LifeBuoy,
  User,
  Bell,
  LogOut,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface MobileNavProps {
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onOpenNova: () => void;
  unreadNotifsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isDrawerOpen,
  onCloseDrawer,
  onOpenNova,
  unreadNotifsCount = 0,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const primaryBottomNav = [
    { label: 'Home', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Markets', path: '/markets', icon: <TrendingUp className="w-5 h-5" /> },
    { label: 'Instant', path: '/instant-order', icon: <Zap className="w-5 h-5" />, highlight: true },
    { label: 'Tasks', path: '/tasks', icon: <ClipboardList className="w-5 h-5" /> },
    { label: 'Wallet', path: '/wallet', icon: <Wallet className="w-5 h-5" /> },
  ];

  const secondaryDrawerNav = [
    { label: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Markets & Analytics', path: '/markets', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Instant Order Training', path: '/instant-order', icon: <Zap className="w-4 h-4" /> },
    { label: 'Training Tasks', path: '/tasks', icon: <ClipboardList className="w-4 h-4" /> },
    { label: 'Order Execution History', path: '/orders', icon: <History className="w-4 h-4" /> },
    { label: 'Institutional Wallet', path: '/wallet', icon: <Wallet className="w-4 h-4" /> },
    { label: 'Document Centre', path: '/documents', icon: <FileText className="w-4 h-4" /> },
    { label: 'Customer & Compliance Support', path: '/support', icon: <LifeBuoy className="w-4 h-4" /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell className="w-4 h-4" />, count: unreadNotifsCount },
    { label: 'Student Profile & Standing', path: '/profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A0C14]/95 backdrop-blur-lg border-t border-border/80 px-2 py-1.5 flex items-center justify-around"
      >
        {primaryBottomNav.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-all duration-150',
                isActive
                  ? 'text-indigo-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              )
            }
          >
            <div
              className={cn(
                'p-1.5 rounded-xl transition-all',
                item.highlight
                  ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25'
                  : ''
              )}
            >
              {item.icon}
            </div>
            <span className="mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Slide-out Drawer Menu */}
      <Drawer isOpen={isDrawerOpen} onClose={onCloseDrawer} side="left" title="Mudrexx Earn">
        <div className="flex flex-col h-full space-y-4">
          {/* User Profile Summary */}
          {user && (
            <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{user.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">ID: {user.id}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Credit Score:</span>
                <span className="text-emerald-400 font-bold">{user.creditScore} ({user.creditStatus})</span>
              </div>
            </div>
          )}

          {/* NOVA Assistant Pill */}
          <button
            onClick={() => {
              onCloseDrawer();
              onOpenNova();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 text-indigo-300 font-semibold text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Launch NOVA Copilot</span>
            </div>
            <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200">
              AI
            </span>
          </button>

          {/* Nav List */}
          <div className="flex-1 space-y-1">
            {secondaryDrawerNav.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onCloseDrawer}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-600 text-white font-bold">
                    {item.count}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          {/* Logout */}
          <div className="pt-4 border-t border-border/60">
            <button
              onClick={() => {
                onCloseDrawer();
                logout();
                navigate('/login');
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Terminal</span>
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
};
