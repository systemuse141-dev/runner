import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { getNotifications, markNotificationsRead } from '../api';
import { NotificationItem, NotificationType } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { formatDateTime, cn } from '../lib/utils';
import {
  Bell,
  CheckCheck,
  Zap,
  ClipboardList,
  LifeBuoy,
  FileText,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { showToast } = useToast();

  const fetchNotifs = async () => {
    try {
      setIsLoading(true);
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.warn('Notifications load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      showToast('info', 'Notifications Updated', 'All system notifications marked as read.');
    } catch (err) {
      console.warn('Mark all read error:', err);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationsRead(item.id);
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, read: true } : n))
      );
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (filterType === 'all') return true;
    return n.type.toLowerCase() === filterType.toLowerCase();
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'Order':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'Task':
        return <ClipboardList className="w-4 h-4 text-gold-400" />;
      case 'Support':
        return <LifeBuoy className="w-4 h-4 text-cyan-400" />;
      case 'Document':
        return <FileText className="w-4 h-4 text-royal-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gold-400" />
              <span>Notification Centre</span>
            </h2>
            <Badge status="LIVE" size="sm" dot>
              REAL-TIME ALERTS
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Order execution results, curriculum deadlines, and institutional supervisor updates
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          leftIcon={<CheckCheck className="w-4 h-4 text-gold-400" />}
          className="text-xs"
        >
          Mark All Read
        </Button>
      </div>

      {/* Tabs Filter */}
      <Tabs
        tabs={[
          { id: 'all', label: 'All Alerts', count: notifications.length },
          { id: 'order', label: 'Orders', count: notifications.filter(n => n.type === 'Order').length },
          { id: 'task', label: 'Tasks', count: notifications.filter(n => n.type === 'Task').length },
          { id: 'support', label: 'Support', count: notifications.filter(n => n.type === 'Support').length },
          { id: 'document', label: 'Documents', count: notifications.filter(n => n.type === 'Document').length },
        ]}
        activeTab={filterType}
        onChange={setFilterType}
        variant="segmented"
        className="max-w-xl"
      />

      {/* Notification List */}
      {filteredNotifs.length === 0 ? (
        <EmptyState
          title="No Alerts Found"
          description="There are no notifications matching your selected filter."
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map(item => (
            <Card
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={cn(
                'p-4 sm:p-5 flex items-start justify-between gap-4 transition-all cursor-pointer',
                !item.read
                  ? 'bg-surface-elevated/90 border-gold-500/40 shadow-md'
                  : 'bg-surface/60 border-border/60 opacity-80'
              )}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
                    )}
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.message}</p>
                  <span className="text-[10px] font-mono text-slate-500 block pt-1">
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>
              </div>

              {item.link && (
                <NavLink to={item.link}>
                  <Button variant="ghost" size="sm" className="text-xs text-gold-400 hover:text-gold-300">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </NavLink>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
