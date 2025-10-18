import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { INITIAL_BALANCE, REFERRAL_PERCENTAGE } from '../utils/constants';
import type { TelegramWebAppUser } from '../utils/telegram';
import { useBalanceStore } from './useBalanceStore';

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
  referrer?: {
    id: string;
    fullName: string;
    commissionRate: number;
  };
}

interface UserStore {
  user: UserProfile | null;
  isInitialized: boolean;
  initialize: (telegramUser?: TelegramWebAppUser | null) => void;
  adjustBalance: (amount: number) => void;
  recordOrder: (spentAmount: number) => void;
  recordTaskCompletion: (rewardAmount: number) => number;
  recordTopUp: (amount: number) => void;
  addReferralEarnings: (amount: number) => void;
  setReferrer: (fullName: string) => void;
  incrementReferrals: () => void;
  reset: () => void;
}

const fullNameFromTelegram = (telegramUser?: TelegramWebAppUser | null): string => {
  if (!telegramUser) {
    return 'Гость Boost';
  }

  const firstName = telegramUser.first_name ?? '';
  const lastName = telegramUser.last_name ?? '';
  const full = `${firstName} ${lastName}`.trim();
  return full || telegramUser.username || 'Пользователь Boost';
};

const firstNameFromTelegram = (telegramUser?: TelegramWebAppUser | null): string =>
  telegramUser?.first_name ?? telegramUser?.username ?? 'Boost';

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      isInitialized: false,
      initialize: (telegramUser = null) => {
        const existing = get().user;

        const baseData = {
          telegramId: telegramUser?.id ?? existing?.telegramId,
          firstName: firstNameFromTelegram(telegramUser) || existing?.firstName || 'Boost',
          lastName: telegramUser?.last_name ?? existing?.lastName,
          fullName: fullNameFromTelegram(telegramUser) || existing?.fullName || 'Boost Пользователь',
          username: telegramUser?.username ?? existing?.username,
          avatarUrl:
            telegramUser?.photo_url ||
            existing?.avatarUrl ||
            `https://api.dicebear.com/7.x/thumbs/svg?seed=${telegramUser?.username ?? 'boost-user'}`
        };

        if (existing) {
          set({
            user: {
              ...existing,
              ...baseData
            },
            isInitialized: true
          });
          return;
        }

        const referralCode = crypto.randomUUID().split('-')[0];

        set({
          user: {
            id: crypto.randomUUID(),
            balance: INITIAL_BALANCE,
            lifetimeEarned: 0,
            lifetimeSpent: 0,
            ordersPlaced: 0,
            tasksCompleted: 0,
            totalTopUps: 0,
            totalTopUpAmount: 0,
            referralsCount: 0,
            referralEarnings: 0,
            referralCode,
            createdAt: new Date().toISOString(),
            ...baseData
          },
          isInitialized: true
        });

        useBalanceStore.getState().logEvent({
          type: 'topup',
          amount: INITIAL_BALANCE,
          description: 'Начислен стартовый баланс'
        });
      },
      adjustBalance: amount =>
        set(state => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              balance: Math.max(0, state.user.balance + amount)
            }
          };
        }),
      recordOrder: spentAmount =>
        set(state => {
          if (!state.user) return state;

          const referralEarnings = state.user.referrer
            ? spentAmount * state.user.referrer.commissionRate
            : 0;

          return {
            user: {
              ...state.user,
              balance: Math.max(0, state.user.balance - spentAmount),
              lifetimeSpent: state.user.lifetimeSpent + spentAmount,
              ordersPlaced: state.user.ordersPlaced + 1,
              referralEarnings: state.user.referralEarnings + referralEarnings
            }
          };
        }),
      recordTaskCompletion: rewardAmount => {
        let referralCommission = 0;
        set(state => {
          if (!state.user) return state;

          referralCommission = state.user.referrer ? rewardAmount * REFERRAL_PERCENTAGE : 0;

          return {
            user: {
              ...state.user,
              balance: state.user.balance + rewardAmount,
              lifetimeEarned: state.user.lifetimeEarned + rewardAmount,
              tasksCompleted: state.user.tasksCompleted + 1
            }
          };
        });
        return referralCommission;
      },
      recordTopUp: amount =>
        set(state => {
          if (!state.user) return state;
          useBalanceStore.getState().logEvent({
            type: 'topup',
            amount,
            description: 'Пополнение через администратора'
          });
          return {
            user: {
              ...state.user,
              balance: state.user.balance + amount,
              totalTopUps: state.user.totalTopUps + 1,
              totalTopUpAmount: state.user.totalTopUpAmount + amount
            }
          };
        }),
      addReferralEarnings: amount =>
        set(state => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              balance: state.user.balance + amount,
              referralEarnings: state.user.referralEarnings + amount
            }
          };
        }),
      setReferrer: fullName =>
        set(state => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              referrer: {
                id: `ref-${fullName.toLowerCase().replace(/\s+/g, '-')}`,
                fullName,
                commissionRate: REFERRAL_PERCENTAGE
              }
            }
          };
        }),
      incrementReferrals: () =>
        set(state => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              referralsCount: state.user.referralsCount + 1
            }
          };
        }),
      reset: () => set({ user: null, isInitialized: false })
    }),
    {
      name: 'boost-user-store'
    }
  )
);
