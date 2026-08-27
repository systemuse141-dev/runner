import React, { useState, useEffect } from 'react';
import { getDocuments, getUserProfile, getWallet } from '../api';
import { DocumentItem, UserProfile, WalletBalance } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/utils';
import {
  FileText,
  Download,
  ShieldCheck,
  Award,
  Lock,
  Calendar,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([getDocuments(), getUserProfile(), getWallet()])
      .then(([docData, profData, walletData]) => {
        setDocuments(docData);
        setProfile(profData);
        setWallet(walletData);
      })
      .catch(err => console.warn('Documents load error:', err));
  }, []);

  const handleDownloadPDF = async (doc: DocumentItem) => {
    if (!profile || !wallet) return;

    setDownloadingId(doc.id);
    try {
      // Dynamic import of PDF generator
      const { generateDocumentPDF } = await import('../lib/pdfGenerator');
      await generateDocumentPDF(doc, profile, wallet);
      showToast('success', 'PDF Generated', `Document ${doc.reference}.pdf has been downloaded.`);
    } catch (err: any) {
      showToast('error', 'Download Failed', err.message || 'Could not compile document PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-gold-500/25 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold-400" />
              <span>Official Document Centre</span>
            </h2>
            <Badge status="OFFICIAL" size="sm" dot>
              OFFICIAL RECORDS
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Certified monthly statements, training agreements, invoices, and proof of account
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Institutional Archive: Secured</span>
        </div>
      </div>

      {/* Document Library Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map(doc => (
          <Card
            key={doc.id}
            className="p-5 sm:p-6 flex flex-col justify-between hover:border-gold-500/40 transition-all group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400 font-mono">
                  {doc.category}
                </span>
                <Badge status={doc.status} size="sm" dot>
                  {doc.status}
                </Badge>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 my-2">
                <FileCheck className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-slate-100 group-hover:text-gold-300 transition-colors leading-snug">
                {doc.title}
              </h3>

              <div className="space-y-1 text-xs font-mono text-slate-400 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span>Reference:</span>
                  <strong className="text-slate-200">{doc.reference}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Issued Date:</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>File Size:</span>
                  <span>{doc.fileSize}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border/60">
              <Button
                variant="gold"
                size="md"
                className="w-full text-xs"
                isLoading={downloadingId === doc.id}
                onClick={() => handleDownloadPDF(doc)}
                leftIcon={<Download className="w-4 h-4 text-gold-400" />}
              >
                Download Verified PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Security & Verification Disclaimer */}
      <Card variant="royal" className="p-5 flex items-start gap-3 text-xs text-slate-400">
        <Lock className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-sans">
          All documents generated through the Mudrexx Earn portal represent official simulated training records.
          Each record carries a cryptographic verification hash matching your student supervisor registry.
        </p>
      </Card>
    </div>
  );
};
