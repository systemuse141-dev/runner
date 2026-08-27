import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Compass, ArrowLeft, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none">
      <Card variant="royal" className="p-8 sm:p-12 max-w-md w-full space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 mx-auto">
          <Compass className="w-8 h-8" />
        </div>
        <span className="text-xs font-mono font-bold text-gold-400 uppercase tracking-widest block">
          404 ERROR — NOT FOUND
        </span>
        <h2 className="text-2xl font-black text-slate-100">Requested Resource Not Located</h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
          The terminal route you requested does not exist or has been relocated to another institutional workspace.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <NavLink to="/" className="w-full sm:w-auto">
            <Button variant="royal" size="md" className="w-full" leftIcon={<Home className="w-4 h-4 text-slate-950" />}>
              Return to Dashboard
            </Button>
          </NavLink>
        </div>
      </Card>
    </div>
  );
};
