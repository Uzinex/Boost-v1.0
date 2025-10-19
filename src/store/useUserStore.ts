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
  profiles: Record<string, UserProfile>;
  activeProfileKey: string | null;
  isInitialized: boolean;
  needsProfileSetup: boolean;
  initialize: (telegramUser?: TelegramWebAppUser | null) => void;
  completeRegistration: (payload: { fullName: string; username?: string }) => void;
  adjustBalance: (amount: number) => void;
  recordOrder: (spentAmount: number) => void;
  recordTaskCompletion: (rewardAmount: number) => number;
  recordTopUp: (amount: number) => void;
  addReferralEarnings: (amount: number) => void;
  setReferrer: (fullName: string) => void;
  incrementReferrals: () => void;
  reset: () => void;
}

const MANUAL_PROFILE_KEY = 'manual-profile';

const buildTelegramProfileKey = (telegramId: number) => `telegram-${telegramId}`;

const withUpdatedActiveProfile = (
  state: UserStore,
  updater: (current: UserProfile) => UserProfile
): Partial<UserStore> => {
  if (!state.user || !state.activeProfileKey) {
    return {};
  }

  const updatedUser = updater(state.user);

  return {
    user: updatedUser,
    profiles: {
      ...state.profiles,
      [state.activeProfileKey]: updatedUser
    }
  };
};

const fullNameFromTelegram = (telegramUser?: TelegramWebAppUser | null): string => {
  if (!telegramUser) {
    return '';
  }

  const firstName = telegramUser.first_name ?? '';
  const lastName = telegramUser.last_name ?? '';
  const full = `${firstName} ${lastName}`.trim();
  return full || telegramUser.username || '';
};

const firstNameFromTelegram = (telegramUser?: TelegramWebAppUser | null): string | undefined =>
  telegramUser?.first_name ?? telegramUser?.username ?? undefined;

const buildAvatarUrl = (seed?: string) =>
  `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed || 'boost-user')}`;

const baseState = {
  user: null,
  profiles: {},
  activeProfileKey: null,
  isInitialized: false,
  needsProfileSetup: false
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      ...baseState,
      initialize: (telegramUser = null) => {
        const { profiles, activeProfileKey } = get();

        if (telegramUser) {
          const profileKey = buildTelegramProfileKey(telegramUser.id);
          const existingProfile = profiles[profileKey];

          const telegramData = {
            telegramId: telegramUser.id,
            firstName:
              firstNameFromTelegram(telegramUser) ?? existingProfile?.firstName ?? 'Boost',
            lastName: telegramUser.last_name ?? existingProfile?.lastName,
            fullName:
              fullNameFromTelegram(telegramUser) || existingProfile?.fullName || 'Boost Пользователь',
            username: telegramUser.username ?? existingProfile?.username,
            avatarUrl:
              telegramUser.photo_url ??
              existingProfile?.avatarUrl ??
              buildAvatarUrl(telegramUser.username ?? telegramUser.first_name ?? 'boost-user')
          };

          if (existingProfile) {
            const updatedProfile: UserProfile = {
              ...existingProfile,
              ...telegramData
            };

            useBalanceStore.getState().setActiveUser(updatedProfile.id);
            set(state => ({
              user: updatedProfile,
              profiles: {
                ...state.profiles,
                [profileKey]: updatedProfile
              },
              activeProfileKey: profileKey,
              isInitialized: true,
              needsProfileSetup: false
            }));
            return;
          }

          const referralCode = crypto.randomUUID().split('-')[0];
          const baseFirstName = telegramData.firstName ?? 'Boost';

          const newUser: UserProfile = {
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
            firstName: baseFirstName,
            lastName: telegramData.lastName,
            fullName: telegramData.fullName || baseFirstName,
            username: telegramData.username,
            telegramId: telegramData.telegramId,
            avatarUrl: telegramData.avatarUrl ?? buildAvatarUrl(baseFirstName),
            referrer: undefined
          };

          useBalanceStore.getState().setActiveUser(newUser.id);
          set(state => ({
            user: newUser,
            profiles: {
              ...state.profiles,
              [profileKey]: newUser
            },
            activeProfileKey: profileKey,
            isInitialized: true,
            needsProfileSetup: false
          }));

          useBalanceStore.getState().logEvent(newUser.id, {
            type: 'topup',
            amount: INITIAL_BALANCE,
            description: 'Начислен стартовый баланс'
          });
          return;
        }

        if (activeProfileKey && profiles[activeProfileKey]) {
          const activeProfile = profiles[activeProfileKey];
          useBalanceStore.getState().setActiveUser(activeProfile.id);
          set({
            user: activeProfile,
            isInitialized: true,
            needsProfileSetup: false
          });
          return;
        }

        const manualProfile = profiles[MANUAL_PROFILE_KEY];
        if (manualProfile) {
          useBalanceStore.getState().setActiveUser(manualProfile.id);
          set({
            user: manualProfile,
            activeProfileKey: MANUAL_PROFILE_KEY,
            isInitialized: true,
            needsProfileSetup: false
          });
          return;
        }

        useBalanceStore.getState().setActiveUser(null);
        set({ user: null, isInitialized: true, needsProfileSetup: true });
      },
      completeRegistration: payload => {
        const trimmedName = payload.fullName.trim();
        if (!trimmedName) {
          throw new Error('Укажите имя и фамилию');
        }

        const nameParts = trimmedName.split(/\s+/);
        const firstName = nameParts[0] ?? trimmedName;
        const lastName = nameParts.slice(1).join(' ') || undefined;
        const normalizedUsername = payload.username
          ? payload.username.replace(/^@+/, '').trim() || undefined
          : undefined;
        const referralCode = crypto.randomUUID().split('-')[0];

        const newUser: UserProfile = {
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
          firstName,
          lastName,
          fullName: trimmedName,
          username: normalizedUsername,
          avatarUrl: buildAvatarUrl(normalizedUsername || trimmedName),
          telegramId: undefined,
          referrer: undefined
        };

        useBalanceStore.getState().setActiveUser(newUser.id);
        set(state => ({
          user: newUser,
          profiles: {
            ...state.profiles,
            [MANUAL_PROFILE_KEY]: newUser
          },
          activeProfileKey: MANUAL_PROFILE_KEY,
          isInitialized: true,
          needsProfileSetup: false
        }));

        useBalanceStore.getState().logEvent(newUser.id, {
          type: 'topup',
          amount: INITIAL_BALANCE,
          description: 'Начислен стартовый баланс'
        });
      },
      adjustBalance: amount =>
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: Math.max(0, current.balance + amount)
          }));
        }),
      recordOrder: spentAmount =>
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          const referralEarnings = state.user.referrer
            ? spentAmount * state.user.referrer.commissionRate
            : 0;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: Math.max(0, current.balance - spentAmount),
            lifetimeSpent: current.lifetimeSpent + spentAmount,
            ordersPlaced: current.ordersPlaced + 1,
            referralEarnings: current.referralEarnings + referralEarnings
          }));
        }),
      recordTaskCompletion: rewardAmount => {
        let referralCommission = 0;
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          referralCommission = state.user.referrer ? rewardAmount * REFERRAL_PERCENTAGE : 0;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: current.balance + rewardAmount,
            lifetimeEarned: current.lifetimeEarned + rewardAmount,
            tasksCompleted: current.tasksCompleted + 1
          }));
        });
        return referralCommission;
      },
      recordTopUp: amount =>
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          useBalanceStore.getState().logEvent(state.user.id, {
            type: 'topup',
            amount,
            description: 'Пополнение через администратора'
          });

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: current.balance + amount,
            totalTopUps: current.totalTopUps + 1,
            totalTopUpAmount: current.totalTopUpAmount + amount
          }));
        }),
      addReferralEarnings: amount =>
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: current.balance + amount,
            referralEarnings: current.referralEarnings + amount
          }));
        }),
      setReferrer: fullName =>
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            referrer: {
              id: `ref-${fullName.toLowerCase().replace(/\s+/g, '-')}`,
              fullName,
              commissionRate: REFERRAL_PERCENTAGE
            }
          }));
        }),
      incrementReferrals: () =>
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            referralsCount: current.referralsCount + 1
          }));
        }),
      reset: () => {
        useBalanceStore.getState().setActiveUser(null);
        set(state => {
          if (!state.activeProfileKey) {
            return {
              ...baseState,
              profiles: state.profiles
            };
          }

          const { [state.activeProfileKey]: _removed, ...restProfiles } = state.profiles;

          return {
            ...baseState,
            profiles: restProfiles
          };
        });
      }
    }),
    {
      name: 'boost-user-store',
      version: 2,
      migrate: () => ({
        ...baseState,
        needsProfileSetup: true
      })
    }
  )
);
