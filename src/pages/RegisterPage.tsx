import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Lock, Mail, User, Key, ShieldCheck, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [invitationCode, setInvitationCode] = useState('MUDREXX-INST-8829');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !invitationCode.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (password && password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    try {
      setIsLoading(true);
      await register(name, email, invitationCode, password);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid invitation code. Contact your institutional desk.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080D] flex flex-col justify-center items-center p-4 sm:p-6 select-none selection:bg-gold-500/30">
      <div className="max-w-md w-full space-y-6 animate-slide-up">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <NavLink to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-gold-500 to-gold-300 p-0.5 shadow-lg shadow-gold-500/20">
              <div className="w-full h-full bg-[#0D0F18] rounded-[10px] flex items-center justify-center font-black text-gold-400 font-mono">
                M
              </div>
            </div>
            <div className="text-left">
              <span className="font-extrabold text-slate-100 text-lg">MUDREXX</span>
              <span className="text-xs font-black uppercase text-gold-400 ml-1 px-1.5 py-0.2 rounded bg-gold-500/10 border border-gold-500/30 font-mono">
                EARN
              </span>
            </div>
          </NavLink>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Institutional Programme Enrollment
          </h2>
          <p className="text-xs text-slate-400">
            Activate your student training profile with an authorized invitation code
          </p>
        </div>

        {/* Enrollment Card */}
        <Card variant="royal" className="p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Input
              label="Full Legal Name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alexander Wright"
              required
              leftElement={<User className="w-4 h-4" />}
            />

            <Input
              label="Institutional Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="student@institution.org"
              required
              leftElement={<Mail className="w-4 h-4" />}
            />

            <div className="space-y-1">
              <Input
                label="Programme Invitation Code"
                type="text"
                value={invitationCode}
                onChange={e => setInvitationCode(e.target.value.toUpperCase())}
                placeholder="MUDREXX-INST-XXXX"
                required
                leftElement={<Key className="w-4 h-4 text-gold-400" />}
                helperText="Provided by your institutional trading supervisor or sponsor."
              />
            </div>

            <Input
              label="Security Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a strong password"
              leftElement={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              leftElement={<Lock className="w-4 h-4" />}
            />

            <div className="p-3 rounded-xl bg-[#0B0E1B] border border-gold-500/20 text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <span>
                By enrolling, you acknowledge that Mudrexx Earn is an educational trading simulator.
                Capital accounts are simulated and managed by the institution.
              </span>
            </div>

            <Button
              type="submit"
              variant="royal"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
            >
              Verify &amp; Enter Programme
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center text-xs text-slate-400">
            <span>Already have an active training account? </span>
            <NavLink to="/login" className="text-gold-400 hover:text-gold-300 font-semibold ml-1">
              Sign In to Terminal
            </NavLink>
          </div>
        </Card>
      </div>
    </div>
  );
};
