import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldCheck,
  TrendingUp,
  Zap,
  Award,
  Layers,
  BarChart2,
  Lock,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Activity,
  Cpu,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getMarkets } from '../api';
import { MarketAsset } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { MiniSparkline } from '../components/charts/MiniSparkline';

export const LandingPage: React.FC = () => {
  const [markets, setMarkets] = useState<MarketAsset[]>([]);

  useEffect(() => {
    getMarkets()
      .then(data => setMarkets(data.slice(0, 4)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Institutional Top Navigation */}
      <header className="h-20 border-b border-border/80 px-6 lg:px-12 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-md shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0D0F18] rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-base bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent font-mono">
                M
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-100 text-lg tracking-tight">MUDREXX</span>
              <span className="text-xs font-black uppercase text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 font-mono">
                EARN
              </span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
              Institutional Training
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NavLink to="/markets">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-300">
              Live Markets
            </Button>
          </NavLink>
          <NavLink to="/login">
            <Button variant="secondary" size="sm">
              Student Sign In
            </Button>
          </NavLink>
          <NavLink to="/register">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Enroll with Invitation
            </Button>
          </NavLink>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-12 lg:py-20 space-y-20">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-mono">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>ACCREDITED INSTITUTIONAL SIMULATION PROGRAMME</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-100 tracking-tight leading-[1.1]">
              Professional Market &amp;{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
                Trading Training
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
              Mudrexx Earn offers a structured institutional curriculum combining authentic real-time
              market feeds with controlled simulated execution workflows, risk calibration matrices,
              and AI-driven quant intelligence.
            </p>

            {/* Clear Training Disclosure Notice */}
            <div className="p-4 rounded-xl bg-surface border border-indigo-500/20 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold font-mono">
                <Lock className="w-3.5 h-3.5" />
                <span>Institutional Programme Governance</span>
              </div>
              <p className="leading-relaxed">
                This programme provides educational training. Instant Order is a training workflow;
                programme account balances are institution-managed simulated capital. Market analytics
                utilize genuine live exchange feeds.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <NavLink to="/register">
                <Button variant="royal" size="lg" rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}>
                  Enter Training Programme
                </Button>
              </NavLink>
              <NavLink to="/markets">
                <Button variant="secondary" size="lg" leftIcon={<TrendingUp className="w-4 h-4 text-cyan-400" />}>
                  Explore Live Markets
                </Button>
              </NavLink>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 text-xs font-mono">
              <div>
                <span className="text-slate-500 uppercase block">Feed Latency</span>
                <span className="text-base font-bold text-slate-200">&lt; 140ms</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase block">Curriculum Modules</span>
                <span className="text-base font-bold text-slate-200">5 Tracks</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase block">Execution Model</span>
                <span className="text-base font-bold text-cyan-400">Simulated L1</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual: Market & Dashboard Preview */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-6 border-indigo-500/30 bg-[#0E111E]/90 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Live Market Feeds (L1)
                  </span>
                </div>
                <Badge status="LIVE" size="sm" dot>
                  LIVE
                </Badge>
              </div>

              {/* Asset list snippet */}
              <div className="divide-y divide-border/40 font-mono my-2">
                {markets.map(m => (
                  <div key={m.symbol} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200 text-sm">{m.symbol}</div>
                      <div className="text-[11px] text-slate-500">{m.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-100 text-sm">{formatCurrency(m.price)}</div>
                      <div className={`text-xs font-semibold ${m.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(m.change24h)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">NOVA AI Quant Engine</span>
                <span className="text-emerald-400 font-bold">Synchronized</span>
              </div>
            </Card>

            {/* Student Progress Snippet Card */}
            <Card className="p-4 bg-surface border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Stage 3 Curriculum Active</h4>
                  <p className="text-[11px] text-slate-400">RSI &amp; Volatility Calibration Modules</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">80% Done</span>
            </Card>
          </div>
        </section>

        {/* Feature Pillars */}
        <section className="space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Institutional Learning Infrastructure
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Engineered to transform trading theory into disciplined, risk-managed quantitative execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3 bg-surface hover:border-indigo-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Genuine Market Analytics</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect directly to multi-asset feeds with OHLCV data, RSI, MACD, Moving Averages,
                and volatility indicators without synthetic distortions.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-surface hover:border-indigo-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Instant Execution Simulator</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Experience high-frequency market mechanics with real-time countdowns, dynamic durations,
                and authoritative institutional settlement algorithms.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-surface hover:border-indigo-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">NOVA Quant Copilot</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive instant AI-driven trade analysis, active order health checks, risk parameter
                supervision, and tailored educational explanations.
              </p>
            </Card>
          </div>
        </section>
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-border/80 bg-[#07080C] py-8 px-6 lg:px-12 mt-auto">
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300 font-mono">MUDREXX EARN</span>
            <span>• Institutional Division</span>
          </div>
          <p className="text-[11px] text-center sm:text-right max-w-md">
            For student training and simulated market education only. No retail deposit or broker-dealer
            custody implied.
          </p>
        </div>
      </footer>
    </div>
  );
};
