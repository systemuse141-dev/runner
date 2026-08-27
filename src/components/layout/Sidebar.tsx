import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  ClipboardList,
  History,
  Wallet,
  FileText,
  LifeBuoy,
  Sparkles,
  Bell,
  User,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface SidebarProps {
  onOpenNova?: () => void;
  unreadNotifsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenNova, unreadNotifsCount = 0 }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Markets', path: '/markets', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Instant Order', path: '/instant-order', icon: <Zap className="w-4 h-4" />, badge: 'Training' },
    { label: 'Tasks', path: '/tasks', icon: <ClipboardList className="w-4 h-4" /> },
    { label: 'Orders', path: '/orders', icon: <History className="w-4 h-4" /> },
    { label: 'Wallet', path: '/wallet', icon: <Wallet className="w-4 h-4" /> },
    { label: 'Documents', path: '/documents', icon: <FileText className="w-4 h-4" /> },
    { label: 'Support', path: '/support', icon: <LifeBuoy className="w-4 h-4" /> },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-[#0C0E17] border-r border-border/80 shrink-0 sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-border/60">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0D0F18] rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-base bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent font-mono">
                M
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-100 text-base tracking-tight group-hover:text-indigo-400 transition-colors">
                MUDREXX
              </span>
              <span className="text-xs font-black uppercase text-cyan-400 px-1 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 font-mono">
                EARN
              </span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
              Institutional Training
            </p>
          </div>
        </NavLink>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
          Programme Menu
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              )
            }
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}

        {/* Institutional Notice Card */}
        <div className="mt-6 mx-1 p-3.5 rounded-xl bg-gradient-to-b from-surface-elevated to-surface border border-indigo-500/20 space-y-2">
          <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold font-mono">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Training Sandbox</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Programme accounts operate in a simulated capital environment with live market feeds.
          </p>
        </div>
      </div>

      {/* Bottom User & Utility Area */}
      <div className="p-3 border-t border-border/60 bg-[#0A0C14] space-y-1">
        {/* NOVA Copilot Button */}
        <button
          onClick={onOpenNova}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 text-indigo-300 hover:brightness-110 transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
            <span>NOVA Copilot</span>
          </div>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
            AI Quant
          </span>
        </button>

        {/* Notifications */}
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            cn(
              'flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-colors',
              isActive ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )
          }
        >
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </div>
          {unreadNotifsCount > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-600 text-white font-bold">
              {unreadNotifsCount}
            </span>
          )}
        </NavLink>

        {/* Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-colors',
              isActive ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )
          }
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold text-indigo-300 shrink-0">
              {user?.name?.charAt(0) || 'S'}
            </div>
            <span className="truncate">{user?.name || 'Student Profile'}</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">ID:{user?.id?.slice(-4) || '8421'}</span>
        </NavLink>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
