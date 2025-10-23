import type { OrderType } from '../utils/constants';
import type { TelegramWebAppUser } from './telegram';

export type OrderStatus = 'active' | 'completed';

type OrderBase = {
  ownerId: string;
  ownerName: string;
  ownerUsername?: string;
  ownerAvatar?: string;
  type: OrderType;
  link: string;
  requestedCount: number;
  completedCount: number;
  pricePerUnit: number;
  totalBudget: number;
  status: OrderStatus;
  createdAt: string;
  botIsAdmin: boolean;
};

export interface Order extends OrderBase {
  id: string;
}

export interface CreateOrderPayload {
  type: OrderType;
  requestedCount: number;
  link: string;
}

export interface UserReferrer {
  id: string;
  fullName: string;
  commissionRate: number;
}

export interface UserProfile {
  id: string;
  telegramId?: number;
  firstName: string;
  lastName?: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  ordersPlaced: number;
  tasksCompleted: number;
  totalTopUps: number;
  totalTopUpAmount: number;
  referralsCount: number;
  referralEarnings: number;
  referralCode: string;
  createdAt: string;
  passwordHash: string;
  referrer?: UserReferrer;
}

export type BalanceEventType = 'topup' | 'spend' | 'earn' | 'referral';

export interface BalanceEvent {
  id: string;
  type: BalanceEventType;
  amount: number;
  description: string;
  createdAt: string;
}

export type PendingTelegramUser = TelegramWebAppUser | null;
