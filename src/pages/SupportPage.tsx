import React, { useState, useEffect } from 'react';
import { getSupportTickets, createSupportTicket, replySupportTicket } from '../api';
import { SupportTicket, SupportCategory } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useToast } from '../context/ToastContext';
import { formatDate, formatDateTime, formatCurrency, cn } from '../lib/utils';
import {
  LifeBuoy,
  Plus,
  Send,
  MessageSquare,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

export const SupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // New ticket form
  const [newCategory, setNewCategory] = useState<SupportCategory>('Account');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newPriority, setNewPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [isCreating, setIsCreating] = useState(false);

  // Reply form
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const { showToast } = useToast();

  const loadTickets = async () => {
    try {
      const data = await getSupportTickets();
      setTickets(data);
      if (data.length > 0 && !selectedTicketId) {
        setSelectedTicketId(data[0].id);
      }
    } catch (err) {
      console.warn('Support load error:', err);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || tickets[0];

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;

    setIsCreating(true);
    try {
      const created = await createSupportTicket({
        category: newCategory,
        subject: newSubject,
        message: newMessage,
        priority: newPriority,
      });

      showToast('success', 'Support Ticket Created', `Ticket #${created.id} submitted to compliance.`);
      setIsNewModalOpen(false);
      setNewSubject('');
      setNewMessage('');
      setTickets(prev => [created, ...prev]);
      setSelectedTicketId(created.id);
    } catch (err: any) {
      showToast('error', 'Submission Failed', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setIsReplying(true);
    try {
      const updated = await replySupportTicket(selectedTicket.id, replyText);
      setReplyText('');
      setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      showToast('success', 'Reply Sent', 'Your message has been added to the ticket.');
    } catch (err: any) {
      showToast('error', 'Reply Failed', err.message);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header & Create Request */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-gold-400" />
              <span>Institutional Support &amp; Compliance Desk</span>
            </h2>
            <Badge status="LIVE" size="sm" dot>
              ACTIVE DESK
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Direct communication with institutional mentors, risk officers, and withdrawal coordinators
          </p>
        </div>

        <Button
          variant="royal"
          size="md"
          onClick={() => setIsNewModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          Create Support Request
        </Button>
      </div>

      {/* Two-Column Support Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ticket List (Left Column) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono px-1">
            Inquiry History ({tickets.length})
          </h3>

          <div className="space-y-3">
            {tickets.map(ticket => {
              const isSelected = selectedTicket?.id === ticket.id;
              return (
                <Card
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    'p-4 transition-all cursor-pointer font-sans',
                    isSelected
                      ? 'bg-surface-elevated border-gold-500/50 shadow-lg shadow-gold-500/5'
                      : 'hover:bg-surface-elevated/60 border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gold-400 font-mono">{ticket.category}</span>
                      <span className="text-[10px] text-slate-500 font-mono">#{ticket.id}</span>
                    </div>
                    <Badge status={ticket.status} size="sm" dot>
                      {ticket.status}
                    </Badge>
                  </div>

                  <h4 className="text-sm font-bold text-slate-100 line-clamp-1">{ticket.subject}</h4>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-border/40 font-mono">
                    <span>{formatDate(ticket.createdAt)}</span>
                    <span>{ticket.messages.length} message(s)</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Conversation View (Right Column) */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <Card className="p-6 flex flex-col h-[640px]">
              {/* Ticket Header */}
              <div className="pb-4 border-b border-border/60">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-gold-400 font-mono">
                      {selectedTicket.category}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">#{selectedTicket.id}</span>
                  </div>
                  <Badge status={selectedTicket.status} size="sm" dot>
                    {selectedTicket.status}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-slate-100">{selectedTicket.subject}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Opened {formatDateTime(selectedTicket.createdAt)}
                </p>

                {/* Withdrawal Details Banner if applicable */}
                {selectedTicket.withdrawalDetails && (
                  <div className="mt-3 p-3 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-gold-400" />
                      <span className="text-slate-200">
                        Requested: <strong>{formatCurrency(selectedTicket.withdrawalDetails.amount, selectedTicket.withdrawalDetails.currency)}</strong>
                      </span>
                    </div>
                    <Badge status={selectedTicket.withdrawalDetails.withdrawalStatus} size="sm" dot>
                      {selectedTicket.withdrawalDetails.withdrawalStatus}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Message History */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {selectedTicket.messages.map(msg => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex flex-col gap-1 max-w-[85%]',
                        isUser ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'
                      )}
                    >
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>{msg.senderName}</span>
                        <span>•</span>
                        <span>{formatDateTime(msg.timestamp)}</span>
                      </div>
                      <div
                        className={cn(
                          'p-4 rounded-2xl text-xs sm:text-sm leading-relaxed',
                          isUser
                            ? 'bg-royal-600 text-white rounded-tr-sm shadow-md'
                            : 'bg-surface-elevated border border-border text-slate-200 rounded-tl-sm'
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box Form */}
              <form onSubmit={handleSendReply} className="pt-3 border-t border-border/60 flex items-center gap-2">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply to the compliance supervisor..."
                  className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500 font-sans"
                />
                <Button
                  type="submit"
                  variant="royal"
                  size="md"
                  disabled={!replyText.trim() || isReplying}
                  isLoading={isReplying}
                  leftIcon={<Send className="w-4 h-4 text-slate-950" />}
                >
                  Send
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="p-12 text-center text-slate-400">Select an inquiry to view conversation</Card>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Create Institutional Support Inquiry"
        description="Submit an official inquiry to your designated training supervisor or compliance desk."
        maxWidth="md"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <Select
            label="Inquiry Category"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value as SupportCategory)}
            options={[
              { value: 'Account', label: 'Account & Enrollment Verification' },
              { value: 'Withdrawal', label: 'Withdrawal & Performance Settlement' },
              { value: 'Order', label: 'Instant Order Execution & Settlement' },
              { value: 'Wallet', label: 'Simulated Balance & Capital Allocation' },
              { value: 'Documents', label: 'Document & Statement Verification' },
              { value: 'Other', label: 'Other Programme Questions' },
            ]}
          />

          <Input
            label="Subject Line"
            placeholder="Brief summary of your inquiry"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Inquiry Message Details
            </label>
            <textarea
              rows={4}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Provide complete details including relevant Order IDs, timestamps, or curriculum modules..."
              required
              className="w-full rounded-xl bg-surface border border-border px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500 font-sans"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsNewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="royal"
              size="md"
              isLoading={isCreating}
            >
              Submit Inquiry
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
