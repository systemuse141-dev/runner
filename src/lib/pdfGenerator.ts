import { UserProfile, WalletBalance, DocumentItem } from '../types';

export async function generateDocumentPDF(
  doc: DocumentItem,
  profile: UserProfile,
  wallet: WalletBalance
): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const docPdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [30, 41, 59]; // Slate 800
  const accentColor = [99, 102, 241]; // Indigo 500
  const textColor = [51, 65, 85];

  // Header Banner
  docPdf.setFillColor(15, 23, 42);
  docPdf.rect(0, 0, 210, 35, 'F');

  // Title
  docPdf.setTextColor(255, 255, 255);
  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(18);
  docPdf.text('MUDREXX EARN', 20, 18);

  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(9);
  docPdf.setTextColor(148, 163, 184);
  docPdf.text('INSTITUTIONAL MARKET & TRADING TRAINING PROGRAMME', 20, 26);

  // Document Type / Badge
  docPdf.setFillColor(99, 102, 241);
  docPdf.roundedRect(140, 12, 55, 12, 2, 2, 'F');
  docPdf.setTextColor(255, 255, 255);
  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(8);
  docPdf.text('OFFICIAL RECORD', 148, 19.5);

  // Document Details Box
  let y = 48;
  docPdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(14);
  docPdf.text(doc.title, 20, y);

  y += 8;
  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(9);
  docPdf.setTextColor(100, 116, 139);
  docPdf.text(`Document Ref: ${doc.reference}  |  Generated: ${new Date().toLocaleDateString('en-US')}`, 20, y);

  // Divider
  y += 6;
  docPdf.setDrawColor(226, 232, 240);
  docPdf.setLineWidth(0.5);
  docPdf.line(20, y, 190, y);

  // Student & Programme Metadata Table
  y += 12;
  docPdf.setFillColor(248, 250, 252);
  docPdf.roundedRect(20, y, 170, 32, 2, 2, 'F');
  docPdf.setDrawColor(226, 232, 240);
  docPdf.roundedRect(20, y, 170, 32, 2, 2, 'D');

  docPdf.setFontSize(9);
  docPdf.setTextColor(100, 116, 139);
  docPdf.text('Participant Name:', 26, y + 8);
  docPdf.text('Student ID / Ref:', 26, y + 16);
  docPdf.text('Curriculum Track:', 26, y + 24);

  docPdf.setFont('helvetica', 'bold');
  docPdf.setTextColor(30, 41, 59);
  docPdf.text(profile.name, 70, y + 8);
  docPdf.text(profile.id, 70, y + 16);
  docPdf.text(profile.programmeTrack, 70, y + 24);

  docPdf.setFont('helvetica', 'normal');
  docPdf.setTextColor(100, 116, 139);
  docPdf.text('Institutional Supervisor:', 120, y + 8);
  docPdf.text('Credit Rating / Standing:', 120, y + 16);
  docPdf.text('Account Status:', 120, y + 24);

  docPdf.setFont('helvetica', 'bold');
  docPdf.setTextColor(30, 41, 59);
  docPdf.text(profile.adminOwner, 160, y + 8);
  docPdf.text(`${profile.creditScore} (${profile.creditStatus})`, 160, y + 16);
  docPdf.text(profile.accountStatus, 160, y + 24);

  // Specific Content Section based on document type
  y += 44;
  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(11);
  docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  docPdf.text('FINANCIAL & TRAINING ALLOCATION SUMMARY', 20, y);

  y += 8;
  docPdf.setFillColor(241, 245, 249);
  docPdf.rect(20, y, 170, 8, 'F');
  docPdf.setFontSize(8);
  docPdf.setTextColor(71, 85, 105);
  docPdf.text('PARAMETER', 25, y + 5.5);
  docPdf.text('SPECIFICATION', 80, y + 5.5);
  docPdf.text('STATUS / AMOUNT', 145, y + 5.5);

  const rows = [
    ['Programme Total Balance', 'Institution-managed simulated training capital', `$${wallet.total.toLocaleString()} USD`],
    ['Available for Execution', 'Unencumbered simulated balance', `$${wallet.available.toLocaleString()} USD`],
    ['Frozen in Open Orders', 'Active risk exposure calibration', `$${wallet.frozen.toLocaleString()} USD`],
    ['Programme Stage', profile.currentStage, 'Enrolled & Verified'],
    ['KYC & Regulatory Verification', 'Identity verified by compliance officer', profile.kycVerified ? 'VERIFIED' : 'PENDING'],
  ];

  y += 8;
  rows.forEach((row, idx) => {
    if (idx % 2 === 1) {
      docPdf.setFillColor(248, 250, 252);
      docPdf.rect(20, y, 170, 7, 'F');
    }
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8);
    docPdf.setTextColor(51, 65, 85);
    docPdf.text(row[0], 25, y + 5);
    docPdf.setTextColor(100, 116, 139);
    docPdf.text(row[1], 80, y + 5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(30, 41, 59);
    docPdf.text(row[2], 145, y + 5);
    y += 7;
  });

  // Institutional Compliance & Legal Notice
  y += 14;
  docPdf.setFillColor(254, 242, 242);
  docPdf.setDrawColor(254, 202, 202);
  docPdf.roundedRect(20, y, 170, 28, 2, 2, 'FD');

  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(8);
  docPdf.setTextColor(153, 27, 27);
  docPdf.text('INSTITUTIONAL DISCLOSURE & NOTICE', 25, y + 6);

  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(7);
  docPdf.setTextColor(127, 29, 29);
  docPdf.text(
    'This document is issued solely for institutional tracking, education, and student training records within Mudrexx Earn.\n' +
    'The values recorded herein represent programme-allocated training resources managed by Mudrexx Academy.\n' +
    'This account is not a depository bank or broker-dealer retail exchange account.',
    25,
    y + 12
  );

  // Signature Block
  y += 40;
  docPdf.setDrawColor(203, 213, 225);
  docPdf.line(25, y, 80, y);
  docPdf.line(125, y, 180, y);

  docPdf.setFontSize(8);
  docPdf.setTextColor(100, 116, 139);
  docPdf.text('Institutional Compliance Officer', 25, y + 5);
  docPdf.text('Student Signature / Acknowledged', 125, y + 5);

  // Footer
  docPdf.setFontSize(7);
  docPdf.setTextColor(148, 163, 184);
  docPdf.text('Mudrexx Earn Institutional Division — Confidential Training Record', 20, 285);
  docPdf.text(`Page 1 of 1`, 180, 285);

  // Save PDF
  docPdf.save(`${doc.reference}.pdf`);
}
