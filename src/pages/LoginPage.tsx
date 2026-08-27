import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('alexander.wright@mudrexx-academy.org');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your institutional email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials. Please verify your login details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] flex flex-col justify-center items-center p-4 sm:p-6 select-none selection:bg-indigo-500/30">
      <div className="max-w-md w-full space-y-6 animate-slide-up">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <NavLink to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0D0F18] rounded-[10px] flex items-center justify-center font-extrabold text-indigo-400 font-mono">
                M
              </div>
            </div>
            <div className="text-left">
              <span className="font-extrabold text-slate-100 text-lg">MUDREXX</span>
              <span className="text-xs font-black uppercase text-cyan-400 ml-1 px-1.5 py-0.2 rounded bg-cyan-500/10 font-mono">
                EARN
              </span>
            </div>
          </NavLink>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Student Terminal Sign In
          </h2>
          <p className="text-xs text-slate-400">
            Access your institutional training portfolio, active orders &amp; tasks
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 bg-surface/90 border-border/80 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Input
              label="Institutional Email / Identifier"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="student@mudrexx-academy.org"
              required
              leftElement={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              leftElement={<Lock className="w-4 h-4" />}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded bg-surface-elevated border-border text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span>Remember session</span>
              </label>

              <span className="text-indigo-400 hover:text-indigo-300 cursor-pointer">
                Supervisor Reset
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Terminal
            </Button>
          </form>

          {/* Quick Sandbox Demo Notice */}
          <div className="mt-6 pt-5 border-t border-border/60 text-center text-xs text-slate-400">
            <span>Enrolling for the first time? </span>
            <NavLink to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold ml-1">
              Activate with Invitation Code
            </NavLink>
          </div>
        </Card>

        {/* Training Compliance Note */}
        <p className="text-[11px] text-center text-slate-500 max-w-sm mx-auto leading-relaxed">
          Mudrexx Earn is an accredited simulation training environment. Account data is
          institution-managed.
        </p>
      </div>
    </div>
  );
};
