import { mockBackend } from './lib/mockBackend';
import {
  MarketAsset,
  OHLCVPoint,
  TechnicalAnalysis,
  OrderConfig,
  TrainingOrder,
  CreateOrderPayload,
  WalletBalance,
  WalletTransaction,
  MoneyFlowPoint,
  StudentTask,
  UserProfile,
  CreditScoreDetail,
  SupportTicket,
  DocumentItem,
  NotificationItem,
  NovaChatMessage,
  NovaStatus
} from './types';

// Standard Friendly Error Messages (Section 28)
export function getFriendlyErrorMessage(status: number, defaultMsg?: string): string {
  switch (status) {
    case 401:
      return 'Session expired. Please sign in again.';
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'The request conflicts with the current state.';
    case 422:
      return 'Please check the information provided.';
    case 429:
      return 'Too many requests. Please wait.';
    case 500:
      return 'Something went wrong. Please try again later.';
    case 503:
      return 'Service temporarily unavailable.';
    default:
      return defaultMsg || 'An unexpected error occurred. Please try again.';
  }
}

// Generic fetch wrapper with graceful fallback to mock backend
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  mockFallback?: () => T | Promise<T>
): Promise<T> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    // If 404 or backend unavailable, fallback to mock if provided
    if (mockFallback) {
      return await mockFallback();
    }

    const errText = await res.text().catch(() => '');
    throw new Error(getFriendlyErrorMessage(res.status, errText));
  } catch (error: any) {
    if (mockFallback) {
      return await mockFallback();
    }
    throw new Error(error.message || 'Service temporarily unavailable.');
  }
}

// ==========================================
// USER & PROFILE APIS
// ==========================================

export async function getUserProfile(): Promise<UserProfile> {
  return apiFetch('/api/user/profile', { method: 'GET' }, () => mockBackend.getProfile());
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  return apiFetch(
    '/api/user/profile',
    { method: 'PUT', body: JSON.stringify(data) },
    () => mockBackend.updateProfile(data)
  );
}

export async function getUserAccount(): Promise<UserProfile & { wallet: WalletBalance }> {
  return apiFetch(
    '/api/user/account',
    { method: 'GET' },
    () => ({
      ...mockBackend.getProfile(),
      wallet: mockBackend.getWallet(),
    })
  );
}

export async function getUserAccountSnapshot(): Promise<{
  profile: UserProfile;
  wallet: WalletBalance;
  activeOrdersCount: number;
  pendingTasksCount: number;
}> {
  return apiFetch(
    '/api/user/account/snapshot',
    { method: 'GET' },
    () => ({
      profile: mockBackend.getProfile(),
      wallet: mockBackend.getWallet(),
      activeOrdersCount: mockBackend.getOrders().filter(o => o.status === 'ACTIVE').length,
      pendingTasksCount: mockBackend.getTasks().filter(t => t.status !== 'COMPLETED').length,
    })
  );
}

// ==========================================
// WALLET APIS
// ==========================================

export async function getWallet(): Promise<WalletBalance> {
  return apiFetch('/api/wallet', { method: 'GET' }, () => mockBackend.getWallet());
}

export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  return apiFetch('/api/wallet/transactions', { method: 'GET' }, () => mockBackend.getTransactions());
}

export async function getMoneyFlow(): Promise<MoneyFlowPoint[]> {
  return apiFetch('/api/wallet/money-flow', { method: 'GET' }, () => mockBackend.getMoneyFlow());
}

// ==========================================
// ORDERS & INSTANT EXECUTION APIS
// ==========================================

export async function getOrderConfig(): Promise<OrderConfig> {
  return apiFetch('/api/order/config', { method: 'GET' }, () => mockBackend.getOrderConfig());
}

export async function getOrderAssets(): Promise<string[]> {
  return apiFetch('/api/order/assets', { method: 'GET' }, () => mockBackend.getOrderConfig().pairs);
}

export async function getOrderCurrencies(): Promise<string[]> {
  return apiFetch('/api/order/currencies', { method: 'GET' }, () => mockBackend.getOrderConfig().currencies);
}

export async function getOrderDurations(): Promise<number[]> {
  return apiFetch('/api/order/durations', { method: 'GET' }, () => mockBackend.getOrderConfig().durations);
}

export async function createOrder(payload: CreateOrderPayload): Promise<TrainingOrder> {
  return apiFetch(
    '/api/orders',
    { method: 'POST', body: JSON.stringify(payload) },
    () => mockBackend.createOrder(payload)
  );
}

export async function getOrders(): Promise<TrainingOrder[]> {
  return apiFetch('/api/orders', { method: 'GET' }, () => mockBackend.getOrders());
}

export async function getOrderById(id: string): Promise<TrainingOrder> {
  return apiFetch(
    `/api/orders/${encodeURIComponent(id)}`,
    { method: 'GET' },
    () => {
      const order = mockBackend.getOrder(id);
      if (!order) throw new Error('The requested order was not found.');
      return order;
    }
  );
}

export async function cancelOrder(id: string): Promise<{ success: boolean }> {
  return apiFetch(
    `/api/orders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
    () => ({ success: mockBackend.cancelOrder(id) })
  );
}

// ==========================================
// TASKS APIS
// ==========================================

export async function getTasks(): Promise<StudentTask[]> {
  return apiFetch('/api/tasks', { method: 'GET' }, () => mockBackend.getTasks());
}

export async function getTaskById(id: string): Promise<StudentTask> {
  return apiFetch(
    `/api/tasks/${encodeURIComponent(id)}`,
    { method: 'GET' },
    () => {
      const task = mockBackend.getTask(id);
      if (!task) throw new Error('The requested task was not found.');
      return task;
    }
  );
}

export async function getTaskStatus(id: string): Promise<{ status: string; progressPercent: number }> {
  return apiFetch(
    `/api/tasks/${encodeURIComponent(id)}/status`,
    { method: 'GET' },
    () => {
      const task = mockBackend.getTask(id);
      if (!task) throw new Error('The requested task was not found.');
      return { status: task.status, progressPercent: task.progressPercent };
    }
  );
}

export async function updateTaskStatus(id: string, status: StudentTask['status']): Promise<StudentTask> {
  return apiFetch(
    `/api/tasks/${encodeURIComponent(id)}/status`,
    { method: 'PUT', body: JSON.stringify({ status }) },
    () => {
      const task = mockBackend.updateTaskStatus(id, status);
      if (!task) throw new Error('Task not found');
      return task;
    }
  );
}

// ==========================================
// MARKETS APIS
// ==========================================

export async function getMarkets(): Promise<MarketAsset[]> {
  return apiFetch('/api/markets', { method: 'GET' }, () => mockBackend.getMarkets());
}

export async function getMarketBySymbol(symbol: string): Promise<MarketAsset> {
  return apiFetch(
    `/api/markets/${encodeURIComponent(symbol)}`,
    { method: 'GET' },
    () => {
      const market = mockBackend.getMarket(symbol);
      if (!market) throw new Error('The requested market asset was not found.');
      return market;
    }
  );
}

export async function getMarketOHLCV(symbol: string, timeframe = '1H'): Promise<OHLCVPoint[]> {
  return apiFetch(
    `/api/markets/${encodeURIComponent(symbol)}/ohlcv?timeframe=${timeframe}`,
    { method: 'GET' },
    () => mockBackend.getOHLCV(symbol, timeframe)
  );
}

export async function getMarketAnalysis(symbol: string): Promise<TechnicalAnalysis> {
  return apiFetch(
    `/api/markets/${encodeURIComponent(symbol)}/analysis`,
    { method: 'GET' },
    () => mockBackend.getTechnicalAnalysis(symbol)
  );
}

// ==========================================
// CREDIT SCORE APIS
// ==========================================

export async function getCreditScore(): Promise<CreditScoreDetail> {
  return apiFetch('/api/credit-score', { method: 'GET' }, () => mockBackend.getCreditScore());
}

export async function getCreditScoreHistory(): Promise<CreditScoreDetail['history']> {
  return apiFetch(
    '/api/credit-score/history',
    { method: 'GET' },
    () => mockBackend.getCreditScore().history
  );
}

// ==========================================
// CUSTOMER SUPPORT & WITHDRAWAL ROUTING APIS
// ==========================================

export async function getSupportTickets(): Promise<SupportTicket[]> {
  return apiFetch('/api/support/tickets', { method: 'GET' }, () => mockBackend.getSupportTickets());
}

export async function createSupportTicket(data: {
  category: SupportTicket['category'];
  subject: string;
  message: string;
  priority?: 'High' | 'Medium' | 'Low';
}): Promise<SupportTicket> {
  return apiFetch(
    '/api/support/tickets',
    { method: 'POST', body: JSON.stringify(data) },
    () => mockBackend.createSupportTicket(data)
  );
}

export async function getSupportTicketById(id: string): Promise<SupportTicket> {
  return apiFetch(
    `/api/support/tickets/${encodeURIComponent(id)}`,
    { method: 'GET' },
    () => {
      const ticket = mockBackend.getSupportTicket(id);
      if (!ticket) throw new Error('Support ticket not found.');
      return ticket;
    }
  );
}

export async function replySupportTicket(id: string, message: string): Promise<SupportTicket> {
  return apiFetch(
    `/api/support/tickets/${encodeURIComponent(id)}/reply`,
    { method: 'POST', body: JSON.stringify({ message }) },
    () => mockBackend.replySupportTicket(id, message)
  );
}

export async function createWithdrawalSupport(data: {
  currency: string;
  amount: number;
  message: string;
}): Promise<SupportTicket> {
  return apiFetch(
    '/api/withdrawal/support',
    { method: 'POST', body: JSON.stringify(data) },
    () => mockBackend.createWithdrawalSupport(data)
  );
}

// ==========================================
// NOTIFICATIONS APIS
// ==========================================

export async function getNotifications(): Promise<NotificationItem[]> {
  return apiFetch('/api/notifications', { method: 'GET' }, () => mockBackend.getNotifications());
}

export async function markNotificationsRead(id?: string): Promise<{ success: boolean }> {
  return apiFetch(
    '/api/notifications/read',
    { method: 'POST', body: JSON.stringify({ id }) },
    () => {
      mockBackend.markNotificationAsRead(id);
      return { success: true };
    }
  );
}

// ==========================================
// DOCUMENTS APIS
// ==========================================

export async function getDocuments(): Promise<DocumentItem[]> {
  return apiFetch('/api/documents', { method: 'GET' }, () => mockBackend.getDocuments());
}

export async function getAccountStatement(): Promise<DocumentItem> {
  return apiFetch('/api/account/statement', { method: 'GET' }, () => mockBackend.getDocuments()[0]);
}

export async function getAccountProof(): Promise<DocumentItem> {
  return apiFetch('/api/account/proof', { method: 'GET' }, () => mockBackend.getDocuments()[1]);
}

export async function getAccountAgreement(): Promise<DocumentItem> {
  return apiFetch('/api/account/agreement', { method: 'GET' }, () => mockBackend.getDocuments()[2]);
}

export async function getAccountInvoice(): Promise<DocumentItem> {
  return apiFetch('/api/account/invoice', { method: 'GET' }, () => mockBackend.getDocuments()[3]);
}

// ==========================================
// NOVA COPILOT APIS
// ==========================================

export async function getNovaStatus(): Promise<NovaStatus> {
  return apiFetch('/api/nova/status', { method: 'GET' }, () => mockBackend.getNovaStatus());
}

export async function postNovaChat(prompt: string): Promise<NovaChatMessage> {
  return apiFetch(
    '/api/nova/chat',
    { method: 'POST', body: JSON.stringify({ prompt }) },
    () => mockBackend.chatWithNova(prompt)
  );
}

// ==========================================
// AUTHENTICATION APIS
// ==========================================

export async function authLogin(email: string, pass: string): Promise<{ token: string; user: UserProfile }> {
  if (!email || !pass) {
    throw new Error('Please provide both email and password.');
  }
  return {
    token: 'jwt_mock_student_' + Date.now(),
    user: mockBackend.getProfile(),
  };
}

export async function authRegister(data: {
  name: string;
  email: string;
  invitationCode: string;
  password?: string;
}): Promise<{ token: string; user: UserProfile }> {
  if (!data.name || !data.email || !data.invitationCode) {
    throw new Error('Please fill in all required registration fields.');
  }
  if (!data.invitationCode.toUpperCase().startsWith('MUDREXX-') && data.invitationCode.length < 5) {
    throw new Error('Invalid invitation code. Please verify the code provided by your institutional supervisor.');
  }
  const user = mockBackend.updateProfile({
    name: data.name,
    email: data.email,
    invitationCode: data.invitationCode.toUpperCase(),
  });
  return {
    token: 'jwt_mock_student_' + Date.now(),
    user,
  };
}
