import {
  MarketAsset,
  OHLCVPoint,
  TechnicalAnalysis,
  OrderConfig,
  TrainingOrder,
  CreateOrderPayload,
  WalletBalance,
  WalletTransaction,
  StudentTask,
  UserProfile,
  CreditScoreDetail,
  SupportTicket,
  DocumentItem,
  NotificationItem,
  NovaChatMessage,
  NovaStatus,
  MoneyFlowPoint
} from '../types';

// ==========================================
// SEED DATA FOR INSTITUTIONAL TRAINING
// ==========================================

const INITIAL_MARKETS: MarketAsset[] = [
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    category: 'crypto',
    price: 64280.50,
    change24h: 3.42,
    high24h: 65120.00,
    low24h: 62100.00,
    volume24h: 28450120000,
    marketCap: 1265800000000,
    rank: 1,
    lastUpdated: new Date().toISOString(),
    source: 'Institutional Aggregate Feed (L1)',
    dataStatus: 'LIVE',
    sparkline: [62200, 62450, 63100, 62900, 63400, 63800, 63500, 64100, 64280.50],
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    category: 'crypto',
    price: 3450.25,
    change24h: 2.15,
    high24h: 3510.00,
    low24h: 3370.00,
    volume24h: 15420300000,
    marketCap: 415200000000,
    rank: 2,
    lastUpdated: new Date().toISOString(),
    source: 'Institutional Aggregate Feed (L1)',
    dataStatus: 'LIVE',
    sparkline: [3380, 3395, 3420, 3410, 3430, 3445, 3435, 3460, 3450.25],
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana',
    category: 'crypto',
    price: 158.40,
    change24h: 6.78,
    high24h: 162.50,
    low24h: 147.20,
    volume24h: 4210000000,
    marketCap: 73800000000,
    rank: 3,
    lastUpdated: new Date().toISOString(),
    source: 'Institutional Aggregate Feed (L1)',
    dataStatus: 'LIVE',
    sparkline: [148, 150, 153, 151, 155, 157, 156, 160, 158.40],
  },
  {
    symbol: 'XRP/USDT',
    name: 'Ripple',
    category: 'crypto',
    price: 0.5842,
    change24h: -1.24,
    high24h: 0.6010,
    low24h: 0.5780,
    volume24h: 1120000000,
    marketCap: 32900000000,
    rank: 4,
    lastUpdated: new Date().toISOString(),
    source: 'Institutional Aggregate Feed (L1)',
    dataStatus: 'LIVE',
    sparkline: [0.592, 0.590, 0.588, 0.585, 0.586, 0.582, 0.584, 0.581, 0.5842],
  },
  {
    symbol: 'AVAX/USDT',
    name: 'Avalanche',
    category: 'crypto',
    price: 28.65,
    change24h: 4.89,
    high24h: 29.40,
    low24h: 26.90,
    volume24h: 640000000,
    marketCap: 11500000000,
    rank: 5,
    lastUpdated: new Date().toISOString(),
    source: 'Institutional Aggregate Feed (L1)',
    dataStatus: 'LIVE',
    sparkline: [27.1, 27.4, 27.8, 27.5, 28.1, 28.3, 28.0, 28.8, 28.65],
  },
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'forex',
    price: 1.0845,
    change24h: 0.12,
    high24h: 1.0870,
    low24h: 1.0820,
    volume24h: 94200000000,
    marketCap: 0,
    rank: 6,
    lastUpdated: new Date().toISOString(),
    source: 'Interbank Forex Feed',
    dataStatus: 'LIVE',
    sparkline: [1.083, 1.0835, 1.084, 1.0842, 1.0838, 1.0845, 1.0843, 1.0848, 1.0845],
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    category: 'forex',
    price: 1.2980,
    change24h: -0.35,
    high24h: 1.3040,
    low24h: 1.2950,
    volume24h: 72100000000,
    marketCap: 0,
    rank: 7,
    lastUpdated: new Date().toISOString(),
    source: 'Interbank Forex Feed',
    dataStatus: 'LIVE',
    sparkline: [1.302, 1.301, 1.300, 1.299, 1.297, 1.2985, 1.2975, 1.2982, 1.2980],
  },
  {
    symbol: 'XAU/USD',
    name: 'Gold / US Dollar',
    category: 'commodities',
    price: 2415.80,
    change24h: 1.45,
    high24h: 2428.00,
    low24h: 2380.00,
    volume24h: 38500000000,
    marketCap: 0,
    rank: 8,
    lastUpdated: new Date().toISOString(),
    source: 'London Bullion Market Feed',
    dataStatus: 'LIVE',
    sparkline: [2385, 2392, 2400, 2408, 2405, 2412, 2410, 2420, 2415.80],
  }
];

const INITIAL_PROFILE: UserProfile = {
  id: 'STU-98421',
  name: 'Alexander Wright',
  username: 'awright_trader',
  email: 'alexander.wright@mudrexx-academy.org',
  phone: '+1 (555) 389-2041',
  invitationCode: 'MUDREXX-INST-8829',
  adminOwner: 'Institutional Oversight Desk (ID: ADM-772)',
  adminUserCode: 'IOD-ALPHA-77',
  accountStatus: 'Active',
  category: 'High Value',
  creditScore: 785,
  creditStatus: 'Optimal Standing',
  createdAt: '2026-03-15T08:30:00Z',
  lastLogin: new Date().toISOString(),
  programmeTrack: 'Advanced Quantitative & Derivative Trading',
  currentStage: 'Stage 3: High-Frequency Instant Execution & Risk Calibration',
  kycVerified: true,
  twoFactorEnabled: true,
};

const INITIAL_WALLET: WalletBalance = {
  total: 24500.00,
  available: 18250.00,
  frozen: 6250.00,
  pending: 0.00,
  currency: 'USD',
  creditScore: 785,
  creditStatus: 'OPTIMAL',
  programmeStage: 'Institutional Stage 3',
  isTrainingAccount: true,
  institutionManaged: true,
};

const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'TX-94012',
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    type: 'ORDER_WIN',
    amount: 1700.00,
    currency: 'USD',
    beforeBalance: 22800.00,
    afterBalance: 24500.00,
    referenceId: 'ORD-89321',
    description: 'Instant Order Settlement Payout (BTC/USDT 60s CALL)',
    status: 'COMPLETED',
  },
  {
    id: 'TX-94011',
    date: new Date(Date.now() - 3600000 * 5).toISOString(),
    type: 'TASK_REWARD',
    amount: 250.00,
    currency: 'USD',
    beforeBalance: 22550.00,
    afterBalance: 22800.00,
    referenceId: 'TSK-104',
    description: 'Programme Task Reward: MACD Divergence Assessment',
    status: 'COMPLETED',
  },
  {
    id: 'TX-94010',
    date: new Date(Date.now() - 86400000 * 1).toISOString(),
    type: 'ORDER_LOSS',
    amount: -500.00,
    currency: 'USD',
    beforeBalance: 23050.00,
    afterBalance: 22550.00,
    referenceId: 'ORD-89210',
    description: 'Instant Order Settlement Loss (ETH/USDT 30s PUT)',
    status: 'COMPLETED',
  },
  {
    id: 'TX-94009',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    type: 'TRAINING_CREDIT',
    amount: 5000.00,
    currency: 'USD',
    beforeBalance: 18050.00,
    afterBalance: 23050.00,
    referenceId: 'ADJ-4421',
    description: 'Institutional Training Capital Top-Up (Stage 3 Grant)',
    status: 'COMPLETED',
  },
  {
    id: 'TX-94008',
    date: new Date(Date.now() - 86400000 * 5).toISOString(),
    type: 'WITHDRAWAL_REQUEST',
    amount: -2500.00,
    currency: 'USD',
    beforeBalance: 20550.00,
    afterBalance: 18050.00,
    referenceId: 'WTH-00129',
    description: 'Student Performance Withdrawal Request — Under Review',
    status: 'UNDER_REVIEW',
  },
  {
    id: 'TX-94001',
    date: '2026-03-15T09:00:00Z',
    type: 'INITIAL_GRANT',
    amount: 20000.00,
    currency: 'USD',
    beforeBalance: 0.00,
    afterBalance: 20000.00,
    referenceId: 'INIT-GRANT-01',
    description: 'Initial Institutional Training Capital Allocation',
    status: 'COMPLETED',
  }
];

const INITIAL_ORDERS: TrainingOrder[] = [
  {
    id: 'ORD-89321',
    userId: 'STU-98421',
    pair: 'BTC/USDT',
    direction: 'CALL',
    amount: 1000.00,
    currency: 'USD',
    entryPrice: 63850.00,
    settlementPrice: 64120.00,
    duration: 60,
    payoutPercentage: 85,
    potentialPayout: 1850.00,
    actualPayout: 1850.00,
    profitLoss: 850.00,
    openedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    expiresAt: new Date(Date.now() - 3600000 * 2 + 60000).toISOString(),
    settledAt: new Date(Date.now() - 3600000 * 2 + 60000).toISOString(),
    status: 'SETTLED',
    result: 'WIN',
    isTraining: true,
  },
  {
    id: 'ORD-89210',
    userId: 'STU-98421',
    pair: 'ETH/USDT',
    direction: 'PUT',
    amount: 500.00,
    currency: 'USD',
    entryPrice: 3410.50,
    settlementPrice: 3425.80,
    duration: 30,
    payoutPercentage: 80,
    potentialPayout: 900.00,
    actualPayout: 0.00,
    profitLoss: -500.00,
    openedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    expiresAt: new Date(Date.now() - 86400000 * 1 + 30000).toISOString(),
    settledAt: new Date(Date.now() - 86400000 * 1 + 30000).toISOString(),
    status: 'SETTLED',
    result: 'LOSE',
    isTraining: true,
  },
  {
    id: 'ORD-89190',
    userId: 'STU-98421',
    pair: 'SOL/USDT',
    direction: 'CALL',
    amount: 750.00,
    currency: 'USD',
    entryPrice: 152.10,
    settlementPrice: 155.80,
    duration: 120,
    payoutPercentage: 85,
    potentialPayout: 1387.50,
    actualPayout: 1387.50,
    profitLoss: 637.50,
    openedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    expiresAt: new Date(Date.now() - 86400000 * 2 + 120000).toISOString(),
    settledAt: new Date(Date.now() - 86400000 * 2 + 120000).toISOString(),
    status: 'SETTLED',
    result: 'WIN',
    isTraining: true,
  },
  {
    id: 'ORD-89150',
    userId: 'STU-98421',
    pair: 'EUR/USD',
    direction: 'CALL',
    amount: 300.00,
    currency: 'USD',
    entryPrice: 1.0830,
    settlementPrice: 1.0830,
    duration: 60,
    payoutPercentage: 80,
    potentialPayout: 540.00,
    actualPayout: 300.00,
    profitLoss: 0.00,
    openedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    expiresAt: new Date(Date.now() - 86400000 * 3 + 60000).toISOString(),
    settledAt: new Date(Date.now() - 86400000 * 3 + 60000).toISOString(),
    status: 'SETTLED',
    result: 'TIE',
    isTraining: true,
  }
];

const INITIAL_TASKS: StudentTask[] = [
  {
    id: 'TSK-101',
    title: 'RSI Divergence Identification & Execution',
    description: 'Identify a bullish or bearish divergence on BTC/USDT 1H timeframe and execute 2 simulated instant orders adhering strictly to 2% max risk parameter.',
    category: 'Technical Analysis',
    priority: 'HIGH',
    status: 'PENDING',
    rewardXP: 150,
    rewardCredit: 100,
    dueDate: new Date(Date.now() + 86400000 * 1).toISOString(),
    instructions: [
      'Navigate to Markets > BTC/USDT and switch to 1H timeframe.',
      'Check RSI (14) indicator for lower lows while price makes higher lows.',
      'Execute 1 Instant Order in the direction of the confirmed divergence.',
      'Submit your rationale in the task notes.'
    ],
    requirements: ['Min 1 Instant Order placed on BTC/USDT', 'RSI reading logged between 30 and 70'],
    progressPercent: 40,
  },
  {
    id: 'TSK-102',
    title: 'Volatility Compression & Bollinger Band Breakout',
    description: 'Observe Bollinger Band squeeze on ETH/USDT and place an instant execution when 4H volatility expands above 3.5%.',
    category: 'Market Mechanics',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    rewardXP: 200,
    rewardCredit: 150,
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    instructions: [
      'Monitor ETH/USDT 4H chart for band contraction below 2.0% bandwidth.',
      'Wait for high volume candle breakout above upper or below lower band.',
      'Execute order with 60s or 120s duration.'
    ],
    requirements: ['Volatility threshold verified', 'Valid trade execution logged'],
    progressPercent: 65,
  },
  {
    id: 'TSK-103',
    title: 'Institutional Risk Calibration: Position Sizing Matrix',
    description: 'Review the institutional draw-down limits and complete the risk parameter assessment test.',
    category: 'Risk Management',
    priority: 'HIGH',
    status: 'OVERDUE',
    rewardXP: 300,
    rewardCredit: 250,
    dueDate: new Date(Date.now() - 86400000 * 1).toISOString(),
    instructions: [
      'Open the Document Centre and download the Institutional Risk Agreement.',
      'Review section 4.2 on max drawdown threshold (5.0%).',
      'Confirm risk acknowledgement in profile settings.'
    ],
    requirements: ['Risk assessment completed', 'Max drawdown acknowledgement signed'],
    progressPercent: 20,
  },
  {
    id: 'TSK-104',
    title: 'MACD Zero-Line Crossover Strategy Analysis',
    description: 'Document 3 occurrences of MACD crossover above zero on SOL/USDT with volume confirmation.',
    category: 'Strategy Execution',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    rewardXP: 250,
    rewardCredit: 200,
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 86400000 * 2 + 3600000 * 4).toISOString(),
    instructions: [
      'Identify MACD 12/26 cross above histogram baseline.',
      'Verify 24h volume > $1.5B.',
      'Complete post-trade analytical evaluation.'
    ],
    requirements: ['3 verified instances documented', 'Evaluation submitted'],
    progressPercent: 100,
  },
  {
    id: 'TSK-105',
    title: 'Institutional Compliance & KYC Tier-2 Verification',
    description: 'Complete training identification verification and sign programme participant charter.',
    category: 'Compliance',
    priority: 'LOW',
    status: 'COMPLETED',
    rewardXP: 100,
    rewardCredit: 50,
    dueDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    completedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    instructions: [
      'Submit training verification form.',
      'Confirm institutional mentor assigned.'
    ],
    requirements: ['Identity verification confirmed', 'Agreement filed'],
    progressPercent: 100,
  }
];

const INITIAL_SUPPORT: SupportTicket[] = [
  {
    id: 'TCK-8821',
    category: 'Withdrawal',
    subject: 'Student Performance Training Grant Withdrawal Request #WTH-00129',
    status: 'Under Review',
    priority: 'High',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    withdrawalDetails: {
      currency: 'USD',
      amount: 2500.00,
      withdrawalStatus: 'Under Review',
    },
    messages: [
      {
        id: 'MSG-1',
        sender: 'user',
        senderName: 'Alexander Wright',
        text: 'Requesting withdrawal of $2,500.00 from verified training profit allocation to registered institutional settlement account.',
        timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'MSG-2',
        sender: 'support',
        senderName: 'Institutional Compliance Desk (ADM-772)',
        text: 'Hello Alexander. Your withdrawal request has been received and logged under reference WTH-00129. Our audit team is verifying your Stage 3 trade compliance metrics. You will receive an update within 24–48 business hours.',
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
      },
      {
        id: 'MSG-3',
        sender: 'user',
        senderName: 'Alexander Wright',
        text: 'Thank you for the update. All required task logs and risk ratios are uploaded.',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'MSG-4',
        sender: 'support',
        senderName: 'Institutional Compliance Desk (ADM-772)',
        text: 'Task logs verified. Pending final risk officer sign-off.',
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
      }
    ]
  },
  {
    id: 'TCK-8815',
    category: 'Order',
    subject: 'Inquiry regarding 60s BTC/USDT Settlement Execution Latency',
    status: 'Resolved',
    priority: 'Medium',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    messages: [
      {
        id: 'MSG-1',
        sender: 'user',
        senderName: 'Alexander Wright',
        text: 'I noticed order #ORD-89150 settled at exactly the entry price (Tie). Could you confirm the tick price feed timestamp?',
        timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
      },
      {
        id: 'MSG-2',
        sender: 'support',
        senderName: 'Market Operations Desk',
        text: 'The order settlement matched the L1 aggregate feed at 1.083000 at the precise millisecond of expiry, resulting in a correct parity (Tie) return of initial capital without penalty.',
        timestamp: new Date(Date.now() - 86400000 * 6).toISOString(),
      }
    ]
  }
];

const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'DOC-2026-001',
    title: 'Monthly Institutional Account Statement (August 2026)',
    type: 'STATEMENT',
    category: 'Account Statement',
    reference: 'STM-AUG-2026-98421',
    createdAt: '2026-08-01T00:00:00Z',
    status: 'OFFICIAL',
    fileSize: '245 KB',
  },
  {
    id: 'DOC-2026-002',
    title: 'Proof of Institutional Training Account & Allocation Standing',
    type: 'PROOF_OF_ACCOUNT',
    category: 'Proof of Account',
    reference: 'PRF-STU-98421-V3',
    createdAt: '2026-07-15T12:00:00Z',
    status: 'VERIFIED',
    fileSize: '180 KB',
  },
  {
    id: 'DOC-2026-003',
    title: 'Institutional Training Programme Agreement & Terms of Service',
    type: 'AGREEMENT',
    category: 'Account Agreement',
    reference: 'AGR-MUDREXX-2026-88',
    createdAt: '2026-03-15T08:30:00Z',
    status: 'OFFICIAL',
    fileSize: '512 KB',
  },
  {
    id: 'DOC-2026-004',
    title: 'Training Programme Tuition & Grant Allocation Invoice',
    type: 'INVOICE',
    category: 'Invoice',
    reference: 'INV-2026-89410',
    createdAt: '2026-03-15T09:00:00Z',
    status: 'VERIFIED',
    fileSize: '160 KB',
  },
  {
    id: 'DOC-2026-005',
    title: 'Performance Payout & Reward Entitlement Schedule',
    type: 'PAYOUT_DOCUMENT',
    category: 'Payout/Agreement Document',
    reference: 'PAY-SCHED-2026-09',
    createdAt: '2026-06-01T00:00:00Z',
    status: 'GENERATED',
    fileSize: '320 KB',
  }
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'NOTIF-1',
    title: 'Instant Order Settled — Win (+ $850.00)',
    message: 'Your 60s CALL order on BTC/USDT settled in profit at $64,120.00.',
    type: 'Order',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    link: '/orders',
    priority: 'high',
  },
  {
    id: 'NOTIF-2',
    title: 'New Training Task Assigned',
    message: 'RSI Divergence Identification & Execution task is due tomorrow.',
    type: 'Task',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    link: '/tasks',
    priority: 'normal',
  },
  {
    id: 'NOTIF-3',
    title: 'Support Ticket Status Update',
    message: 'Compliance Desk replied on Ticket #TCK-8821 regarding withdrawal request.',
    type: 'Support',
    read: true,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    link: '/support',
    priority: 'normal',
  },
  {
    id: 'NOTIF-4',
    title: 'Monthly Account Statement Available',
    message: 'Your August 2026 Institutional Account Statement has been compiled and is ready for download.',
    type: 'Document',
    read: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    link: '/documents',
    priority: 'normal',
  },
  {
    id: 'NOTIF-5',
    title: 'Institutional Credit Score Update: 785 (+15 pts)',
    message: 'Consistent risk management and zero max drawdown breaches earned a credit rating upgrade.',
    type: 'Programme',
    read: true,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    link: '/profile',
    priority: 'high',
  }
];

const INITIAL_CREDIT_SCORE: CreditScoreDetail = {
  score: 785,
  maxScore: 850,
  rating: 'Optimal Standing',
  status: 'Unrestricted Institutional Access',
  updatedAt: new Date().toISOString(),
  factors: [
    {
      name: 'Trade Execution Discipline',
      score: 95,
      impact: 'POSITIVE',
      description: 'Strict adherence to assigned position limits and stop-loss boundaries.',
    },
    {
      name: 'Task Completion Rate',
      score: 88,
      impact: 'POSITIVE',
      description: '80% of assigned technical training modules submitted before due dates.',
    },
    {
      name: 'Risk Management Factor',
      score: 92,
      impact: 'POSITIVE',
      description: 'Max account drawdown maintained well below 5% institutional boundary.',
    },
    {
      name: 'Account Longevity & Compliance',
      score: 82,
      impact: 'POSITIVE',
      description: 'Zero compliance disputes or security infractions.',
    }
  ],
  history: [
    { date: '2026-08-20', score: 785, reason: 'Completed MACD Zero-Line Module', change: +15 },
    { date: '2026-07-25', score: 770, reason: 'Consecutive Win Streak Execution', change: +20 },
    { date: '2026-06-10', score: 750, reason: 'Mid-term Risk Assessment Sign-off', change: +10 },
    { date: '2026-03-15', score: 740, reason: 'Initial Student Baseline Calibration', change: 0 }
  ]
};

// ==========================================
// MOCK STATE STORAGE WITH LOCALSTORAGE BACKING
// ==========================================

class MockStore {
  private markets: MarketAsset[] = INITIAL_MARKETS;
  private profile: UserProfile = INITIAL_PROFILE;
  private wallet: WalletBalance = INITIAL_WALLET;
  private transactions: WalletTransaction[] = INITIAL_TRANSACTIONS;
  private orders: TrainingOrder[] = INITIAL_ORDERS;
  private tasks: StudentTask[] = INITIAL_TASKS;
  private supportTickets: SupportTicket[] = INITIAL_SUPPORT;
  private documents: DocumentItem[] = INITIAL_DOCUMENTS;
  private notifications: NotificationItem[] = INITIAL_NOTIFICATIONS;
  private creditScore: CreditScoreDetail = INITIAL_CREDIT_SCORE;

  constructor() {
    this.loadFromStorage();
    this.startLivePriceSimulation();
    this.startOrderMonitor();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedOrders = localStorage.getItem('mudrexx_orders');
      if (savedOrders) this.orders = JSON.parse(savedOrders);

      const savedWallet = localStorage.getItem('mudrexx_wallet');
      if (savedWallet) this.wallet = JSON.parse(savedWallet);

      const savedTx = localStorage.getItem('mudrexx_transactions');
      if (savedTx) this.transactions = JSON.parse(savedTx);

      const savedTasks = localStorage.getItem('mudrexx_tasks');
      if (savedTasks) this.tasks = JSON.parse(savedTasks);

      const savedSupport = localStorage.getItem('mudrexx_support');
      if (savedSupport) this.supportTickets = JSON.parse(savedSupport);

      const savedNotifs = localStorage.getItem('mudrexx_notifications');
      if (savedNotifs) this.notifications = JSON.parse(savedNotifs);

      const savedProfile = localStorage.getItem('mudrexx_profile');
      if (savedProfile) this.profile = JSON.parse(savedProfile);
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('mudrexx_orders', JSON.stringify(this.orders));
      localStorage.setItem('mudrexx_wallet', JSON.stringify(this.wallet));
      localStorage.setItem('mudrexx_transactions', JSON.stringify(this.transactions));
      localStorage.setItem('mudrexx_tasks', JSON.stringify(this.tasks));
      localStorage.setItem('mudrexx_support', JSON.stringify(this.supportTickets));
      localStorage.setItem('mudrexx_notifications', JSON.stringify(this.notifications));
      localStorage.setItem('mudrexx_profile', JSON.stringify(this.profile));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // Live price slight drift for authentic live feel (within realistic micro-ticks)
  private startLivePriceSimulation() {
    if (typeof window === 'undefined') return;
    setInterval(() => {
      this.markets = this.markets.map(asset => {
        const volatility = asset.symbol.includes('BTC') ? 15 : asset.symbol.includes('ETH') ? 1.5 : asset.symbol.includes('SOL') ? 0.25 : 0.0002;
        const delta = (Math.random() - 0.495) * volatility;
        const newPrice = Math.max(0.0001, +(asset.price + delta).toFixed(asset.category === 'forex' ? 4 : asset.price < 1 ? 4 : 2));
        const updatedSparkline = [...asset.sparkline.slice(1), newPrice];
        return {
          ...asset,
          price: newPrice,
          high24h: Math.max(asset.high24h, newPrice),
          low24h: Math.min(asset.low24h, newPrice),
          lastUpdated: new Date().toISOString(),
          sparkline: updatedSparkline,
        };
      });
    }, 2500);
  }

  // Check active orders for automated expiration and settlement
  private startOrderMonitor() {
    if (typeof window === 'undefined') return;
    setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      this.orders = this.orders.map(order => {
        if (order.status === 'ACTIVE') {
          const expiryTime = new Date(order.expiresAt).getTime();
          if (now >= expiryTime) {
            hasChanges = true;
            // Determine settlement price from market
            const market = this.markets.find(m => m.symbol === order.pair);
            const settlementPrice = market ? market.price : order.entryPrice;

            let result: 'WIN' | 'LOSE' | 'TIE' = 'TIE';
            let actualPayout = 0;
            let profitLoss = 0;

            if (order.direction === 'CALL' || order.direction === 'BUY') {
              if (settlementPrice > order.entryPrice) {
                result = 'WIN';
                actualPayout = order.potentialPayout;
                profitLoss = +(actualPayout - order.amount).toFixed(2);
              } else if (settlementPrice < order.entryPrice) {
                result = 'LOSE';
                actualPayout = 0;
                profitLoss = -order.amount;
              } else {
                result = 'TIE';
                actualPayout = order.amount;
                profitLoss = 0;
              }
            } else {
              // PUT / SELL
              if (settlementPrice < order.entryPrice) {
                result = 'WIN';
                actualPayout = order.potentialPayout;
                profitLoss = +(actualPayout - order.amount).toFixed(2);
              } else if (settlementPrice > order.entryPrice) {
                result = 'LOSE';
                actualPayout = 0;
                profitLoss = -order.amount;
              } else {
                result = 'TIE';
                actualPayout = order.amount;
                profitLoss = 0;
              }
            }

            // Update wallet balances
            this.wallet.frozen = Math.max(0, +(this.wallet.frozen - order.amount).toFixed(2));
            if (result === 'WIN') {
              this.wallet.available = +(this.wallet.available + actualPayout).toFixed(2);
              this.wallet.total = +(this.wallet.total + profitLoss).toFixed(2);
            } else if (result === 'TIE') {
              this.wallet.available = +(this.wallet.available + order.amount).toFixed(2);
            } else {
              this.wallet.total = +(this.wallet.total - order.amount).toFixed(2);
            }

            // Record transaction
            const tx: WalletTransaction = {
              id: `TX-${Date.now().toString().slice(-6)}`,
              date: new Date().toISOString(),
              type: result === 'WIN' ? 'ORDER_WIN' : result === 'LOSE' ? 'ORDER_LOSS' : 'ADJUSTMENT',
              amount: result === 'WIN' ? profitLoss : result === 'LOSE' ? -order.amount : 0,
              currency: order.currency,
              beforeBalance: this.wallet.total - profitLoss,
              afterBalance: this.wallet.total,
              referenceId: order.id,
              description: `Instant Order Settled: ${order.pair} ${order.direction} (${result})`,
              status: 'COMPLETED',
            };
            this.transactions.unshift(tx);

            // Add notification
            this.notifications.unshift({
              id: `NOTIF-${Date.now()}`,
              title: `Instant Order ${result}: ${order.pair}`,
              message: `Order #${order.id} closed at ${settlementPrice}. Result: ${result} (${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)})`,
              type: 'Order',
              read: false,
              createdAt: new Date().toISOString(),
              link: '/orders',
              priority: result === 'WIN' ? 'high' : 'normal',
            });

            return {
              ...order,
              status: 'SETTLED',
              settlementPrice,
              actualPayout,
              profitLoss,
              result,
              settledAt: new Date().toISOString(),
            };
          }
        }
        return order;
      });

      if (hasChanges) {
        this.saveToStorage();
      }
    }, 1000);
  }

  // Public Getters and Actions
  public getMarkets(): MarketAsset[] {
    return this.markets;
  }

  public getMarket(symbol: string): MarketAsset | undefined {
    return this.markets.find(m => m.symbol === symbol || m.symbol === decodeURIComponent(symbol));
  }

  public getOHLCV(symbol: string, timeframe = '1H'): OHLCVPoint[] {
    const market = this.getMarket(symbol) || this.markets[0];
    const basePrice = market.price;
    const points: OHLCVPoint[] = [];
    const count = 40;
    const intervalMs = 3600000;
    const now = Date.now();

    let current = basePrice * 0.96;
    for (let i = count; i >= 0; i--) {
      const time = now - i * intervalMs;
      const variation = (Math.random() - 0.48) * (basePrice * 0.015);
      const open = current;
      const close = +(open + variation).toFixed(2);
      const high = +(Math.max(open, close) + Math.random() * (basePrice * 0.008)).toFixed(2);
      const low = +(Math.min(open, close) - Math.random() * (basePrice * 0.008)).toFixed(2);
      const volume = Math.floor(Math.random() * 5000000 + 1000000);

      points.push({ timestamp: time, open, high, low, close, volume });
      current = close;
    }
    return points;
  }

  public getTechnicalAnalysis(symbol: string): TechnicalAnalysis {
    const market = this.getMarket(symbol) || this.markets[0];
    const p = market.price;
    const isUp = market.change24h >= 0;

    return {
      symbol: market.symbol,
      price: p,
      trend: isUp ? 'STRONGLY_BULLISH' : 'BEARISH',
      momentum: 'STRONG',
      rsi14: isUp ? 62.4 : 44.8,
      rsiSignal: 'NEUTRAL',
      macd: {
        macd: +(p * 0.004).toFixed(2),
        signal: +(p * 0.003).toFixed(2),
        histogram: +(p * 0.001).toFixed(2),
        trend: isUp ? 'BULLISH_CROSS' : 'BEARISH_CROSS',
      },
      sma20: +(p * 0.985).toFixed(2),
      sma50: +(p * 0.970).toFixed(2),
      ema12: +(p * 0.992).toFixed(2),
      ema26: +(p * 0.980).toFixed(2),
      volatility: 3.42,
      supportLevels: [+(p * 0.965).toFixed(2), +(p * 0.940).toFixed(2), +(p * 0.915).toFixed(2)],
      resistanceLevels: [+(p * 1.025).toFixed(2), +(p * 1.050).toFixed(2), +(p * 1.080).toFixed(2)],
      summary: `Market structure shows solid accumulation with high institutional volume on the 4H chart. Key support at ${+(p * 0.965).toFixed(2)} remains defended.`,
      freshness: 'Real-time calculation (L1 Market Engine)',
    };
  }

  public getOrderConfig(): OrderConfig {
    return {
      minAmount: 50,
      maxAmount: 10000,
      defaultAmount: 500,
      defaultDuration: 60,
      durations: [30, 60, 120, 300, 600],
      pairs: this.markets.map(m => m.symbol),
      currencies: ['USD', 'USDT'],
      defaultPayoutPercentage: 85,
      payoutPercentages: {
        'BTC/USDT': 85,
        'ETH/USDT': 85,
        'SOL/USDT': 82,
        'XRP/USDT': 80,
        'AVAX/USDT': 80,
        'EUR/USD': 82,
        'GBP/USD': 80,
        'XAU/USD': 85,
      },
      tradingFeePercentage: 0,
      isTrainingMode: true,
    };
  }

  public createOrder(payload: CreateOrderPayload): TrainingOrder {
    const market = this.getMarket(payload.pair) || this.markets[0];
    const payoutPct = this.getOrderConfig().payoutPercentages[payload.pair] || 85;
    const potentialPayout = +(payload.amount * (1 + payoutPct / 100)).toFixed(2);

    if (this.wallet.available < payload.amount) {
      throw new Error('Insufficient available programme balance to place this order.');
    }

    // Deduct available, add to frozen
    this.wallet.available = +(this.wallet.available - payload.amount).toFixed(2);
    this.wallet.frozen = +(this.wallet.frozen + payload.amount).toFixed(2);

    const now = Date.now();
    const order: TrainingOrder = {
      id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      userId: this.profile.id,
      pair: payload.pair,
      direction: payload.direction,
      amount: payload.amount,
      currency: payload.currency || 'USD',
      entryPrice: market.price,
      currentPrice: market.price,
      duration: payload.duration,
      payoutPercentage: payoutPct,
      potentialPayout,
      openedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + payload.duration * 1000).toISOString(),
      status: 'ACTIVE',
      result: 'ACTIVE',
      isTraining: true,
    };

    this.orders.unshift(order);
    this.saveToStorage();
    return order;
  }

  public getOrders(): TrainingOrder[] {
    return this.orders;
  }

  public getOrder(id: string): TrainingOrder | undefined {
    return this.orders.find(o => o.id === id);
  }

  public cancelOrder(id: string): boolean {
    const order = this.orders.find(o => o.id === id);
    if (!order || order.status !== 'ACTIVE') return false;

    // Refund frozen
    this.wallet.frozen = Math.max(0, +(this.wallet.frozen - order.amount).toFixed(2));
    this.wallet.available = +(this.wallet.available + order.amount).toFixed(2);

    order.status = 'CANCELLED';
    order.result = 'CANCELLED';
    order.settledAt = new Date().toISOString();
    order.actualPayout = order.amount;
    order.profitLoss = 0;

    this.saveToStorage();
    return true;
  }

  public getWallet(): WalletBalance {
    return this.wallet;
  }

  public getTransactions(): WalletTransaction[] {
    return this.transactions;
  }

  public getMoneyFlow(): MoneyFlowPoint[] {
    const days = 7;
    const data: MoneyFlowPoint[] = [];
    const now = Date.now();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      data.push({
        date: dateStr,
        credits: Math.floor(Math.random() * 1200 + 400),
        debits: Math.floor(Math.random() * 600 + 100),
        balance: +(this.wallet.total - i * 350 + (Math.random() * 200 - 100)).toFixed(2),
        orderMovements: Math.floor(Math.random() * 2500 + 1000),
      });
    }
    return data;
  }

  public getTasks(): StudentTask[] {
    return this.tasks;
  }

  public getTask(id: string): StudentTask | undefined {
    return this.tasks.find(t => t.id === id);
  }

  public updateTaskStatus(id: string, status: StudentTask['status']): StudentTask | undefined {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return undefined;

    task.status = status;
    if (status === 'COMPLETED') {
      task.progressPercent = 100;
      task.completedAt = new Date().toISOString();
      // Add XP & credit
      this.wallet.available = +(this.wallet.available + task.rewardCredit).toFixed(2);
      this.wallet.total = +(this.wallet.total + task.rewardCredit).toFixed(2);
      this.creditScore.score = Math.min(850, this.creditScore.score + 10);
      this.transactions.unshift({
        id: `TX-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        type: 'TASK_REWARD',
        amount: task.rewardCredit,
        currency: 'USD',
        beforeBalance: this.wallet.total - task.rewardCredit,
        afterBalance: this.wallet.total,
        referenceId: task.id,
        description: `Task Completed Reward: ${task.title}`,
        status: 'COMPLETED',
      });
    }
    this.saveToStorage();
    return task;
  }

  public getProfile(): UserProfile {
    return this.profile;
  }

  public updateProfile(updates: Partial<UserProfile>): UserProfile {
    this.profile = { ...this.profile, ...updates };
    this.saveToStorage();
    return this.profile;
  }

  public getCreditScore(): CreditScoreDetail {
    return this.creditScore;
  }

  public getSupportTickets(): SupportTicket[] {
    return this.supportTickets;
  }

  public getSupportTicket(id: string): SupportTicket | undefined {
    return this.supportTickets.find(t => t.id === id);
  }

  public createSupportTicket(data: {
    category: SupportTicket['category'];
    subject: string;
    message: string;
    priority?: 'High' | 'Medium' | 'Low';
    withdrawalDetails?: SupportTicket['withdrawalDetails'];
  }): SupportTicket {
    const newTicket: SupportTicket = {
      id: `TCK-${Math.floor(8000 + Math.random() * 2000)}`,
      category: data.category,
      subject: data.subject,
      status: 'Open',
      priority: data.priority || 'Medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      withdrawalDetails: data.withdrawalDetails,
      messages: [
        {
          id: `MSG-${Date.now()}`,
          sender: 'user',
          senderName: this.profile.name,
          text: data.message,
          timestamp: new Date().toISOString(),
        }
      ]
    };

    this.supportTickets.unshift(newTicket);
    this.saveToStorage();
    return newTicket;
  }

  public replySupportTicket(ticketId: string, message: string): SupportTicket {
    const ticket = this.supportTickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.messages.push({
      id: `MSG-${Date.now()}`,
      sender: 'user',
      senderName: this.profile.name,
      text: message,
      timestamp: new Date().toISOString(),
    });
    ticket.updatedAt = new Date().toISOString();
    ticket.status = 'Open';

    // Simulated auto-acknowledgement from compliance desk
    setTimeout(() => {
      ticket.messages.push({
        id: `MSG-${Date.now() + 1}`,
        sender: 'support',
        senderName: 'Institutional Support Desk',
        text: 'Thank you for your response. An institutional specialist has been assigned to your message.',
        timestamp: new Date().toISOString(),
      });
      ticket.status = 'In Progress';
      ticket.updatedAt = new Date().toISOString();
      this.saveToStorage();
    }, 4000);

    this.saveToStorage();
    return ticket;
  }

  public createWithdrawalSupport(data: { currency: string; amount: number; message: string }): SupportTicket {
    if (data.amount > this.wallet.available) {
      throw new Error(`Requested amount ($${data.amount.toFixed(2)}) exceeds available balance ($${this.wallet.available.toFixed(2)}).`);
    }

    // Lock requested funds as pending
    this.wallet.available = +(this.wallet.available - data.amount).toFixed(2);
    this.wallet.pending = +(this.wallet.pending + data.amount).toFixed(2);

    const ticket = this.createSupportTicket({
      category: 'Withdrawal',
      subject: `Withdrawal Request: ${data.amount} ${data.currency}`,
      message: data.message || `Student withdrawal request for ${data.amount} ${data.currency}. Routing to compliance review.`,
      priority: 'High',
      withdrawalDetails: {
        currency: data.currency,
        amount: data.amount,
        withdrawalStatus: 'Pending',
      }
    });

    this.transactions.unshift({
      id: `TX-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      type: 'WITHDRAWAL_REQUEST',
      amount: -data.amount,
      currency: data.currency,
      beforeBalance: this.wallet.total,
      afterBalance: this.wallet.total,
      referenceId: ticket.id,
      description: `Performance Withdrawal Request (${ticket.id})`,
      status: 'UNDER_REVIEW',
    });

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      title: 'Withdrawal Request Submitted',
      message: `Your request to withdraw $${data.amount.toFixed(2)} has been routed to institutional support desk (Ticket #${ticket.id}).`,
      type: 'Support',
      read: false,
      createdAt: new Date().toISOString(),
      link: '/support',
      priority: 'high',
    });

    this.saveToStorage();
    return ticket;
  }

  public getDocuments(): DocumentItem[] {
    return this.documents;
  }

  public getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  public markNotificationAsRead(id?: string): void {
    if (id) {
      const item = this.notifications.find(n => n.id === id);
      if (item) item.read = true;
    } else {
      this.notifications.forEach(n => (n.read = true));
    }
    this.saveToStorage();
  }

  public getNovaStatus(): NovaStatus {
    return {
      available: true,
      model: 'NOVA Institutional Copilot v3.4 (Quant Intelligence)',
      latencyMs: 140,
      supportedIntents: [
        'market_analysis',
        'active_orders',
        'wallet_breakdown',
        'tasks_summary',
        'technical_indicator_explanation',
        'documents_access',
        'support_tickets'
      ],
    };
  }

  public chatWithNova(prompt: string): NovaChatMessage {
    const clean = prompt.toLowerCase();
    let responseText = '';
    let suggestions: string[] = [];
    let dataRef: NovaChatMessage['dataRef'] = undefined;

    if (clean.includes('btc') || clean.includes('bitcoin')) {
      const btc = this.markets.find(m => m.symbol === 'BTC/USDT')!;
      responseText = `**Bitcoin (BTC/USDT) Analysis:**
Current Price: **$${btc.price.toLocaleString()}** (24h: **${btc.change24h > 0 ? '+' : ''}${btc.change24h}%**)
• Technical Structure: Bullish ascending channel on 4H timeframe.
• RSI (14): 62.4 (Neutral-Bullish momentum)
• Key Resistance: $65,500 | Immediate Support: $63,100
• Suggested Institutional Workflow: Look for consolidation above $64,000 before initiating Instant Orders.`;
      suggestions = ['Analyze ETH', 'Show my active orders', 'Check my tasks'];
      dataRef = { type: 'market', symbol: 'BTC/USDT', details: btc };
    } else if (clean.includes('eth') || clean.includes('ethereum')) {
      const eth = this.markets.find(m => m.symbol === 'ETH/USDT')!;
      responseText = `**Ethereum (ETH/USDT) Analysis:**
Current Price: **$${eth.price.toLocaleString()}** (24h: **${eth.change24h > 0 ? '+' : ''}${eth.change24h}%**)
• 24h Volume: $15.42B with strong derivative open interest.
• Key Pivot Level: $3,420 | Overhead Target: $3,580
• Volatility is currently expanding, presenting favorable conditions for 60s and 120s training orders.`;
      suggestions = ['Analyze SOL', 'Place Instant Order', 'How much is frozen?'];
      dataRef = { type: 'market', symbol: 'ETH/USDT', details: eth };
    } else if (clean.includes('frozen') || clean.includes('wallet') || clean.includes('balance')) {
      responseText = `**Institutional Account Balance Breakdown:**
• **Total Programme Balance:** $${this.wallet.total.toLocaleString()} USD
• **Available for Execution:** $${this.wallet.available.toLocaleString()} USD
• **Frozen in Active Orders:** $${this.wallet.frozen.toLocaleString()} USD
• **Pending Withdrawals:** $${this.wallet.pending.toLocaleString()} USD
• **Credit Rating:** ${this.wallet.creditScore} (${this.wallet.creditStatus})`;
      suggestions = ['Show my active orders', 'Show my tasks', 'Check my documents'];
      dataRef = { type: 'wallet', details: this.wallet };
    } else if (clean.includes('active') || clean.includes('order')) {
      const active = this.orders.filter(o => o.status === 'ACTIVE');
      if (active.length === 0) {
        responseText = `You currently have **0 active training orders**. All previous orders have been settled. Your total settled orders count is **${this.orders.length}**.`;
      } else {
        responseText = `You have **${active.length} active training order(s)**:\n` +
          active.map(o => `• **${o.pair}** ${o.direction} | Amount: $${o.amount} | Entry: $${o.entryPrice} | Expires in: ${Math.max(0, Math.round((new Date(o.expiresAt).getTime() - Date.now()) / 1000))}s`).join('\n');
      }
      suggestions = ['Place Instant Order', 'Analyze BTC', 'Show my tasks'];
      dataRef = { type: 'order', details: active };
    } else if (clean.includes('task')) {
      const pending = this.tasks.filter(t => t.status !== 'COMPLETED');
      responseText = `**Your Training Tasks Overview:**
• **Total Assigned:** ${this.tasks.length}
• **Pending / In Progress:** ${pending.length}
• **Completed:** ${this.tasks.length - pending.length}
Next priority task: **${pending[0]?.title || 'All tasks up to date!'}** (Due: ${pending[0]?.dueDate ? new Date(pending[0].dueDate).toLocaleDateString() : 'N/A'})`;
      suggestions = ['Show my active orders', 'Explain RSI', 'Check my documents'];
      dataRef = { type: 'task', details: pending };
    } else if (clean.includes('rsi') || clean.includes('indicator')) {
      responseText = `**Relative Strength Index (RSI) Masterclass:**
• The RSI is a momentum oscillator measuring the speed and change of price movements on a scale from 0 to 100.
• **Overbought (> 70):** Suggests asset may be overextended; watch for bearish reversal confirmation.
• **Oversold (< 30):** Suggests aggressive selling; watch for bullish consolidation.
• **Institutional Tip:** Look for *divergence* between price peaks and RSI peaks for high-probability setups.`;
      suggestions = ['Analyze BTC', 'Explain MACD', 'Show my tasks'];
    } else if (clean.includes('document') || clean.includes('statement')) {
      responseText = `**Document Centre:**
You have **${this.documents.length} official programme documents** available for instant download, including your August 2026 Monthly Statement and Institutional Training Charter.`;
      suggestions = ['Show my tasks', 'How much is frozen?', 'Check my support requests'];
      dataRef = { type: 'document', details: this.documents };
    } else if (clean.includes('support') || clean.includes('ticket') || clean.includes('withdraw')) {
      const tickets = this.supportTickets;
      responseText = `**Support & Compliance Desk:**
You have **${tickets.length} support requests on file**.
Latest request: **${tickets[0]?.subject}** (Status: **${tickets[0]?.status}**)`;
      suggestions = ['Analyze BTC', 'How much is frozen?', 'Show my tasks'];
    } else {
      responseText = `I'm **NOVA**, your institutional trading co-pilot. I can analyze live market feeds, check your simulated active orders, calculate risk exposures, and track your programme curriculum. How can I assist you today?`;
      suggestions = ['Analyze BTC', 'Show my active orders', 'How much is frozen?', 'Show my tasks'];
    }

    return {
      id: `NOVA-${Date.now()}`,
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      suggestions,
      dataRef,
    };
  }
}

// Export singleton instance
export const mockBackend = new MockStore();
