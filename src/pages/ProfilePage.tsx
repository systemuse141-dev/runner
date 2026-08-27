import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCreditScore } from '../api';
import { CreditScoreDetail } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import { formatDate, formatDateTime } from '../lib/utils';
import {
  User,
  ShieldCheck,
  Key,
  Sparkles,
  Award,
  Lock,
  Mail,
  Phone,
  Calendar,
  Building,
  CheckCircle2,
  History,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [creditDetail, setCreditDetail] = useState<CreditScoreDetail | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || '');
    }
    getCreditScore()
      .then(setCreditDetail)
      .catch(err => console.warn('Credit score fetch error:', err));
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUser({ name, email, phone });
      showToast('success', 'Profile Updated', 'Your institutional information has been saved.');
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Profile Header Banner */}
      <Card variant="royal" className="p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-gold-500 to-gold-300 p-0.5 shadow-xl shadow-gold-500/20 shrink-0">
              <div className="w-full h-full bg-[#0E1222] rounded-[14px] flex items-center justify-center text-2xl font-black text-gold-400 font-mono">
                {user.name.charAt(0)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-100">{user.name}</h2>
                <Badge status={user.category} size="sm" dot>
                  {user.category}
                </Badge>
                <Badge status={user.accountStatus} size="sm" dot>
                  {user.accountStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Student ID: <strong className="text-slate-200">{user.id}</strong> • Enrolled: {formatDate(user.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#0C0F1D] border border-gold-500/30 text-right">
              <span className="text-[10px] uppercase text-slate-500 block">Credit Standing</span>
              <span className="text-xl font-black text-gold-400">{user.creditScore}</span>
              <span className="text-[10px] text-emerald-400 block font-semibold">{user.creditStatus}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Identity & Contact Form */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="pb-3 border-b border-border/60">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-gold-400" />
                <span>Personal &amp; Contact Information</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verified identity records registered in the training directory
              </p>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <Input
                label="Full Legal Name"
                value={name}
                onChange={e => setName(e.target.value)}
                leftElement={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Registered Institutional Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                leftElement={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Emergency Contact Phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                leftElement={<Phone className="w-4 h-4" />}
                placeholder="+1 (555) 000-0000"
              />

              <div className="pt-2 flex justify-end">
                <Button variant="royal" type="submit" isLoading={isSaving}>
                  Save Profile Updates
                </Button>
              </div>
            </form>
          </Card>

          {/* Institutional Mentorship & Ownership Section */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="pb-3 border-b border-border/60">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Building className="w-4 h-4 text-cyan-400" />
                <span>Institutional Supervision &amp; Ownership</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assigned institutional compliance desk and supervision authority
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Admin Owner</span>
                <span className="font-bold text-slate-200 mt-0.5 block">{user.adminOwner}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Admin User Code</span>
                <span className="font-bold text-gold-400 mt-0.5 block">{user.adminUserCode}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Invitation Code</span>
                <span className="font-bold text-slate-200 mt-0.5 block">{user.invitationCode}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border/60">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Curriculum Stage</span>
                <span className="font-bold text-emerald-400 mt-0.5 block">{user.currentStage.split(':')[0]}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Credit Score Calibration & Risk Matrix */}
        <div className="lg:col-span-5 space-y-6">
          <Card variant="royal" className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold-400" />
                <h3 className="text-base font-bold text-slate-100">Credit Score Breakdown</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">{user.creditScore} / 850</span>
            </div>

            {creditDetail && (
              <div className="space-y-3">
                {creditDetail.factors.map((factor, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface-elevated/80 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-200">{factor.name}</span>
                      <span className="font-bold text-emerald-400">{factor.score}/100</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      {factor.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Credit Score Rating History */}
          <Card className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <History className="w-4 h-4 text-gold-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Rating Audit History
              </h3>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {creditDetail?.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated/40 text-slate-400">
                  <div>
                    <span className="text-slate-300 font-semibold">{h.reason}</span>
                    <span className="text-[10px] text-slate-500 block">{h.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-200">{h.score} pts</span>
                    {h.change !== 0 && (
                      <span className="text-[10px] text-emerald-400 block font-semibold">+{h.change}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
