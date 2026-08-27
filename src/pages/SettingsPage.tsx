import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import {
  Settings,
  Shield,
  Bell,
  Moon,
  Lock,
  Cpu,
  Smartphone,
  Eye,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);

  const { showToast } = useToast();

  const handleSave = () => {
    showToast('success', 'Preferences Saved', 'Your workspace preferences have been applied.');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-4xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gold-400" />
              <span>Terminal &amp; Security Settings</span>
            </h2>
            <Badge status="OPTIMAL" size="sm" dot>
              CONFIGURED
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Performance toggles, display preferences, and institutional authentication settings
          </p>
        </div>

        <Button variant="royal" size="sm" onClick={handleSave}>
          Save Preferences
        </Button>
      </div>

      {/* Security & Authentication */}
      <Card className="p-6 space-y-4">
        <div className="pb-3 border-b border-border/60">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gold-400" />
            <span>Security &amp; Institutional Two-Factor</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your biometric and authenticator login security
          </p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-surface-elevated border border-border">
          <div>
            <h4 className="text-xs font-bold text-slate-200">Two-Factor Authentication (2FA)</h4>
            <p className="text-xs text-slate-400">Required for institutional trade executions above $5,000</p>
          </div>
          <Badge status="ACTIVE" size="sm" dot>
            ENABLED
          </Badge>
        </div>
      </Card>

      {/* Performance & Display */}
      <Card className="p-6 space-y-4">
        <div className="pb-3 border-b border-border/60">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Performance &amp; Battery Optimization</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Optimize rendering speed for mobile devices and low-power conditions
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated/70 border border-border">
            <div>
              <span className="font-bold text-slate-200 block">Tab Inactivity Auto-Pause</span>
              <span className="text-slate-400 text-[11px]">Automatically halts background market ticks when tab is minimized</span>
            </div>
            <Badge status="ACTIVE" size="sm">
              ON (HARDWARE PROTECT)
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated/70 border border-border">
            <div>
              <span className="font-bold text-slate-200 block">Prefers Reduced Motion</span>
              <span className="text-slate-400 text-[11px]">Disables non-essential slide and fade transitions</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reduceMotion}
                onChange={e => setReduceMotion(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-500 border border-border" />
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
};
