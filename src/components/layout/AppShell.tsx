import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { NovaFloating } from './NovaFloating';
import { getNotifications } from '../../api';
import { NotificationItem } from '../../types';

interface AppShellProps {
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNovaOpen, setIsNovaOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const location = useLocation();

  // Page title mapping based on pathname
  const getPageInfo = (path: string): { title: string; subtitle: string } => {
    switch (path) {
      case '/':
      case '/dashboard':
        return {
          title: 'Student Dashboard',
          subtitle: 'Institutional Training Overview & Portfolio Metrics',
        };
      case '/markets':
        return {
          title: 'Live Markets Terminal',
          subtitle: 'Authentic Real-Time Market Intelligence & Technical Feeds',
        };
      case '/instant-order':
        return {
          title: 'Instant Execution Training',
          subtitle: 'Simulated Order Calibration & Latency Analysis',
        };
      case '/tasks':
        return {
          title: 'Training Tasks & Modules',
          subtitle: 'Structured Curriculum & Risk Management Exercises',
        };
      case '/orders':
        return {
          title: 'Execution Log & History',
          subtitle: 'Comprehensive Order Audit & Settlement Ledger',
        };
      case '/wallet':
        return {
          title: 'Programme Capital & Ledger',
          subtitle: 'Institutionally Allocated Balances & Performance Ledger',
        };
      case '/documents':
        return {
          title: 'Official Document Centre',
          subtitle: 'Statements, Risk Agreements & Programme Proof Records',
        };
      case '/support':
        return {
          title: 'Compliance & Support Desk',
          subtitle: 'Direct Inquiries, Mentorship & Withdrawal Routing',
        };
      case '/profile':
        return {
          title: 'Student Identity & Standing',
          subtitle: 'Verification, Institutional Mentorship & Credit Score',
        };
      case '/notifications':
        return {
          title: 'System Notifications',
          subtitle: 'Platform Alerts, Order Settlements & Task Updates',
        };
      default:
        if (path.startsWith('/markets/')) {
          return {
            title: 'Asset Terminal Analysis',
            subtitle: 'Institutional Deep-Dive & Multi-Timeframe Technical Indicators',
          };
        }
        return {
          title: 'Mudrexx Earn',
          subtitle: 'Professional Market & Trading Training',
        };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(err => console.warn('Notifications fetch error:', err));
  }, [location.pathname]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Left Sidebar (Desktop) */}
      <Sidebar
        onOpenNova={() => setIsNovaOpen(true)}
        unreadNotifsCount={unreadCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <TopBar
          pageTitle={pageInfo.title}
          pageSubtitle={pageInfo.subtitle}
          onOpenMobileMenu={() => setIsDrawerOpen(true)}
          onOpenNova={() => setIsNovaOpen(prev => !prev)}
          unreadNotifsCount={unreadCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children || <Outlet />}
        </main>
      </div>

      {/* Mobile Bottom Bar & Slide Drawer */}
      <MobileNav
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={() => setIsDrawerOpen(false)}
        onOpenNova={() => setIsNovaOpen(true)}
        unreadNotifsCount={unreadCount}
      />

      {/* NOVA Floating Assistant */}
      <NovaFloating
        isOpen={isNovaOpen}
        onToggle={() => setIsNovaOpen(prev => !prev)}
        onClose={() => setIsNovaOpen(false)}
      />
    </div>
  );
};
