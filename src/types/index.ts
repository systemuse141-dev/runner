// ==========================================
// MUDREXX EARN — TYPESCRIPT TYPE DEFINITIONS
// ==========================================

export type MarketDataStatus = 'LIVE' | 'DELAYED' | 'CACHED' | 'UNAVAILABLE';

export interface MarketAsset {
  symbol: string;
  name: string;
  category: 'crypto' | 'forex' | 'indices' | 'commodities';
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  rank: number;
  lastUpdated: string;
  source: string;
  dataStatus: MarketDataStatus;
  sparkline: number[];
}

export interface OHLCVPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalAnalysis {
  symbol: string;
  price: number;
  trend: 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
  momentum: 'STRONG' | 'MODERATE' | 'WEAK';
  rsi14: number;
  rsiSignal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  };
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  volatility: number; // percentage
  supportLevels: number[];
  resistanceLevels: number[];
  summary: string;
  freshness: string;
}

export type OrderDirection = 'CALL' | 'PUT' | 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'ACTIVE' | 'SETTLED' | 'CANCELLED';
export type OrderResult = 'WIN' | 'LOSE' | 'TIE' | 'CANCELLED' | 'ACTIVE';

export interface OrderConfig {
  minAmount: number;
  maxAmount: number;
  defaultAmount: number;
  defaultDuration: number;
  durations: number[]; // e.g. [30, 60, 120, 300, 600]
  pairs: string[];
  currencies: string[];
  defaultPayoutPercentage: number;
  payoutPercentages: Record<string, number>;
  tradingFeePercentage: number;
  isTrainingMode: boolean;
}

export interface TrainingOrder {
  id: string;
  userId: string;
  pair: string;
  direction: OrderDirection;
  amount: number;
  currency: string;
  entryPrice: number;
  currentPrice?: number;
  settlementPrice?: number;
  duration: number; // in seconds
  payoutPercentage: number;
  potentialPayout: number;
  actualPayout?: number;
  profitLoss?: number;
  openedAt: string;
  expiresAt: string;
  settledAt?: string;
  status: OrderStatus;
  result?: OrderResult;
  isTraining: boolean;
}

export interface CreateOrderPayload {
  pair: string;
  direction: OrderDirection;
  amount: number;
  duration: number;
  currency?: string;
}

export interface WalletBalance {
  total: number;
  available: number;
  frozen: number;
  pending: number;
  currency: string;
  creditScore: number;
  creditStatus: 'OPTIMAL' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'RESTRICTED';
  programmeStage: string;
  isTrainingAccount: boolean;
  institutionManaged: boolean;
}

export interface WalletTransaction {
  id: string;
  date: string;
  type: 'TRAINING_CREDIT' | 'ORDER_WIN' | 'ORDER_LOSS' | 'ORDER_ENTRY' | 'TASK_REWARD' | 'WITHDRAWAL_REQUEST' | 'ADJUSTMENT' | 'INITIAL_GRANT';
  amount: number;
  currency: string;
  beforeBalance: number;
  afterBalance: number;
  referenceId: string;
  description: string;
  status: 'COMPLETED' | 'PENDING' | 'UNDER_REVIEW' | 'REJECTED' | 'CANCELLED';
}

export interface MoneyFlowPoint {
  date: string;
  credits: number;
  debits: number;
  balance: number;
  orderMovements: number;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'OVERDUE';
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StudentTask {
  id: string;
  title: string;
  description: string;
  category: 'Technical Analysis' | 'Risk Management' | 'Market Mechanics' | 'Strategy Execution' | 'Compliance';
  priority: TaskPriority;
  status: TaskStatus;
  rewardXP: number;
  rewardCredit: number;
  dueDate: string;
  completedAt?: string;
  instructions: string[];
  requirements: string[];
  progressPercent: number;
}

export type UserCategory = 'New' | 'Active' | 'VIP' | 'High Value' | 'At Risk' | 'Inactive' | 'Restricted' | 'Completed';
export type AccountStatus = 'Active' | 'Restricted' | 'Inactive' | 'Pending Verification';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  invitationCode: string;
  adminOwner: string;
  adminUserCode: string;
  accountStatus: AccountStatus;
  category: UserCategory;
  creditScore: number;
  creditStatus: string;
  createdAt: string;
  lastLogin: string;
  programmeTrack: string;
  currentStage: string;
  kycVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface CreditScoreDetail {
  score: number;
  maxScore: number;
  rating: string;
  status: string;
  updatedAt: string;
  factors: {
    name: string;
    score: number;
    impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    description: string;
  }[];
  history: {
    date: string;
    score: number;
    reason: string;
    change: number;
  }[];
}

export type SupportCategory = 'Withdrawal' | 'Account' | 'Order' | 'Wallet' | 'Documents' | 'Other';
export type SupportStatus = 'Open' | 'Pending User Reply' | 'In Progress' | 'Under Review' | 'Resolved' | 'Closed';

export interface SupportTicketMessage {
  id: string;
  sender: 'user' | 'support' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  attachments?: { name: string; url: string; size: string }[];
}

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: 'High' | 'Medium' | 'Low';
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
  withdrawalDetails?: {
    currency: string;
    amount: number;
    withdrawalStatus: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Cancelled' | 'Completed';
  };
}

export interface DocumentItem {
  id: string;
  title: string;
  type: 'STATEMENT' | 'PROOF_OF_ACCOUNT' | 'AGREEMENT' | 'INVOICE' | 'PAYOUT_DOCUMENT';
  category: string;
  reference: string;
  createdAt: string;
  status: 'VERIFIED' | 'GENERATED' | 'OFFICIAL' | 'ARCHIVED';
  fileSize: string;
  downloadUrl?: string;
}

export type NotificationType = 'System' | 'Order' | 'Task' | 'Support' | 'Document' | 'Programme';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  link?: string;
  priority?: 'normal' | 'high';
}

export interface NovaChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: string[];
  dataRef?: {
    type: 'market' | 'order' | 'wallet' | 'task' | 'document';
    symbol?: string;
    details?: any;
  };
}

export interface NovaStatus {
  available: boolean;
  model: string;
  latencyMs: number;
  supportedIntents: string[];
}
