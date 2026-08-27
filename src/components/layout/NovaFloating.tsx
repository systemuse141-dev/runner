import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Bot, User, RefreshCw, ChevronRight, HelpCircle } from 'lucide-react';
import { NovaChatMessage, NovaStatus } from '../../types';
import { postNovaChat, getNovaStatus } from '../../api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface NovaFloatingProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const NovaFloating: React.FC<NovaFloatingProps> = ({ isOpen, onToggle, onClose }) => {
  const [messages, setMessages] = useState<NovaChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am **NOVA**, your institutional training copilot. I provide real-time market analysis, active order tracking, and training curriculum guidance. How can I assist your workflow today?',
      timestamp: new Date().toISOString(),
      suggestions: [
        'Analyze BTC',
        'Show my active orders',
        'How much is frozen?',
        'Show my tasks',
        'Explain RSI',
      ],
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<NovaStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getNovaStatus()
      .then(setStatus)
      .catch(err => console.warn('Nova status error:', err));
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isLoading) return;

    const userMsg: NovaChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputVal('');
    setIsLoading(true);

    try {
      const response = await postNovaChat(text);
      setMessages(prev => [...prev, response]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to connect to NOVA quant service. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-20 sm:bottom-6 right-5 sm:right-6 z-40 p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2.5 group"
          aria-label="Open NOVA AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-cyan-200 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-bold font-mono tracking-wide hidden sm:inline">
            NOVA AI
          </span>
        </button>
      )}

      {/* Expandable Glass Panel */}
      {isOpen && (
        <div className="fixed bottom-0 sm:bottom-6 right-0 sm:right-6 z-50 w-full sm:w-[420px] h-[580px] max-h-[90vh] bg-[#0E111E]/95 backdrop-blur-2xl border border-indigo-500/30 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="p-4 bg-surface-elevated/70 border-b border-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-100 font-mono">NOVA Copilot</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {status?.model ? 'Quant Intelligence L3' : 'Online'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: 'welcome',
                      role: 'assistant',
                      content: 'Chat history cleared. How may I assist your training workflow?',
                      timestamp: new Date().toISOString(),
                      suggestions: ['Analyze BTC', 'Show my active orders', 'How much is frozen?'],
                    },
                  ])
                }
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                title="Reset conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                aria-label="Close NOVA"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map(msg => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col gap-1.5 max-w-[88%]',
                    isAssistant ? 'self-start' : 'self-end items-end'
                  )}
                >
                  <div
                    className={cn(
                      'p-3.5 rounded-2xl leading-relaxed',
                      isAssistant
                        ? 'bg-surface-elevated/90 border border-border text-slate-200 rounded-tl-sm'
                        : 'bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-600/20'
                    )}
                  >
                    <div className="whitespace-pre-line font-sans">
                      {msg.content.split('**').map((chunk, i) =>
                        i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-100">{chunk}</strong> : chunk
                      )}
                    </div>
                  </div>

                  {/* Quick Suggestion Pills */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1 pt-1">
                      {msg.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(sug)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 text-[11px] font-mono transition-colors text-left"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="self-start p-3 rounded-2xl bg-surface-elevated border border-border text-slate-400 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                <span className="font-mono text-[11px]">Computing market metrics...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-1.5 bg-surface/50 border-t border-border/40 flex items-center gap-1.5 overflow-x-auto">
            {['Analyze BTC', 'Show orders', 'Balance', 'Tasks'].map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="whitespace-nowrap px-2 py-0.5 rounded-md bg-surface-elevated text-[10px] text-slate-400 hover:text-slate-200 border border-border/60 transition-colors font-mono"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-surface-elevated/80 border-t border-border/80 flex items-center gap-2"
          >
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Ask NOVA (e.g. 'Analyze BTC', 'How much is frozen?')..."
              className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!inputVal.trim() || isLoading}
              className="p-2 h-9 w-9 shrink-0"
              aria-label="Send message to NOVA"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};
