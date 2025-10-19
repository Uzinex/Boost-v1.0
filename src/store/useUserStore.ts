import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { INITIAL_BALANCE, REFERRAL_PERCENTAGE } from '../utils/constants';
import type { TelegramWebAppUser } from '../utils/telegram';
import { useBalanceStore } from './useBalanceStore';
import { hashPassword } from '../utils/security';

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
  referrer?: {
    id: string;
    fullName: string;
    commissionRate: number;
  };
}

type AuthMode = 'login' | 'register';

interface UserStore {
  user: UserProfile | null;
  profiles: Record<string, UserProfile>;
  activeProfileKey: string | null;
  isInitialized: boolean;
  needsProfileSetup: boolean;
  authMode: AuthMode | null;
  pendingTelegramUser: TelegramWebAppUser | null;
  pendingProfileKey: string | null;
  initialize: (telegramUser?: TelegramWebAppUser | null) => void;
  registerWithPassword: (payload: { password: string }) => Promise<void>;
  loginWithPassword: (payload: { password: string }) => Promise<void>;
  logout: () => void;
  adjustBalance: (amount: number) => void;
  recordOrder: (spentAmount: number) => void;
  recordTaskCompletion: (rewardAmount: number) => number;
  recordTopUp: (amount: number) => void;
  addReferralEarnings: (amount: number) => void;
  setReferrer: (fullName: string) => void;
  incrementReferrals: () => void;
}

const buildTelegramProfileKey = (telegramId: number) => `telegram-${telegramId}`;

const sanitizeUsername = (username?: string | null) => username?.replace(/^@+/, '').trim() || undefined;

const normalizeUsername = (username?: string | null) => sanitizeUsername(username)?.toLowerCase();

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

const mergeWithTelegramData = (profile: UserProfile, telegramUser?: TelegramWebAppUser | null): UserProfile => {
  if (!telegramUser) {
    return profile;
  }

  const username = sanitizeUsername(telegramUser.username) ?? profile.username;

  return {
    ...profile,
    telegramId: telegramUser.id,
    firstName: firstNameFromTelegram(telegramUser) ?? profile.firstName,
    lastName: telegramUser.last_name ?? profile.lastName,
    fullName: fullNameFromTelegram(telegramUser) || profile.fullName,
    username,
    avatarUrl: telegramUser.photo_url ?? profile.avatarUrl ?? buildAvatarUrl(username)
  };
};

const baseState = {
  user: null as UserProfile | null,
  profiles: {} as Record<string, UserProfile>,
  activeProfileKey: null as string | null,
  isInitialized: false,
  needsProfileSetup: false,
  authMode: null as AuthMode | null,
  pendingTelegramUser: null as TelegramWebAppUser | null,
  pendingProfileKey: null as string | null
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      ...baseState,
      initialize: (telegramUser = null) => {
        const state = get();
        const { user, activeProfileKey, profiles } = state;

        if (user && activeProfileKey) {
          const updatedUser = telegramUser?.id === user.telegramId ? mergeWithTelegramData(user, telegramUser) : user;
          useBalanceStore.getState().setActiveUser(updatedUser.id);
          set({
            user: updatedUser,
            profiles: updatedUser === user ? profiles : { ...profiles, [activeProfileKey]: updatedUser },
            isInitialized: true,
            needsProfileSetup: false,
            authMode: null,
            pendingTelegramUser: null,
            pendingProfileKey: null
          });
          return;
        }

        useBalanceStore.getState().setActiveUser(null);

        if (telegramUser) {
          const profileKey = buildTelegramProfileKey(telegramUser.id);
          const existingProfile = profiles[profileKey];

          if (existingProfile) {
            const syncedProfile = mergeWithTelegramData(existingProfile, telegramUser);
            set({
              user: null,
              profiles: {
                ...profiles,
                [profileKey]: syncedProfile
              },
              activeProfileKey: null,
              isInitialized: true,
              needsProfileSetup: true,
              authMode: 'login',
              pendingTelegramUser: telegramUser,
              pendingProfileKey: profileKey
            });
            return;
          }

          set({
            user: null,
            activeProfileKey: null,
            isInitialized: true,
            needsProfileSetup: true,
            authMode: telegramUser.username ? 'register' : null,
            pendingTelegramUser: telegramUser,
            pendingProfileKey: telegramUser.username ? profileKey : null
          });
          return;
        }

        set({
          user: null,
          activeProfileKey: null,
          isInitialized: true,
          needsProfileSetup: true,
          authMode: null,
          pendingTelegramUser: null,
          pendingProfileKey: null
        });
      },
      registerWithPassword: async ({ password }) => {
        const { pendingProfileKey, pendingTelegramUser } = get();

        if (!pendingProfileKey || !pendingTelegramUser) {
          throw new Error('Регистрация недоступна. Перезапустите приложение.');
        }

        const telegramUsernameRaw = sanitizeUsername(pendingTelegramUser.username);
        if (!telegramUsernameRaw) {
          throw new Error('У вашего Telegram аккаунта отсутствует имя пользователя.');
        }

        if (!password || password.length < 6) {
          throw new Error('Пароль должен содержать не менее 6 символов.');
        }

        const passwordHash = await hashPassword(password);
        const referralCode = crypto.randomUUID().split('-')[0];
        const baseFirstName = firstNameFromTelegram(pendingTelegramUser) ?? 'Boost';

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
          lastName: pendingTelegramUser.last_name ?? undefined,
          fullName: fullNameFromTelegram(pendingTelegramUser) || baseFirstName,
          username: telegramUsernameRaw,
          telegramId: pendingTelegramUser.id,
          avatarUrl:
            pendingTelegramUser.photo_url ??
            buildAvatarUrl(pendingTelegramUser.username ?? pendingTelegramUser.first_name ?? 'boost-user'),
          passwordHash,
          referrer: undefined
        };

        useBalanceStore.getState().setActiveUser(newUser.id);

        set(state => ({
          user: newUser,
          profiles: {
            ...state.profiles,
            [pendingProfileKey]: newUser
          },
          activeProfileKey: pendingProfileKey,
          isInitialized: true,
          needsProfileSetup: false,
          authMode: null,
          pendingTelegramUser: null,
          pendingProfileKey: null
        }));

        useBalanceStore.getState().logEvent(newUser.id, {
          type: 'topup',
          amount: INITIAL_BALANCE,
          description: 'Начислен стартовый баланс'
        });
      },
      loginWithPassword: async ({ password }) => {
        const { pendingProfileKey, pendingTelegramUser, profiles } = get();
        if (!pendingProfileKey) {
          throw new Error('Профиль не найден.');
        }

        const storedProfile = profiles[pendingProfileKey];
        if (!storedProfile) {
          throw new Error('Профиль не найден.');
        }

        if (!password) {
          throw new Error('Введите пароль.');
        }

        const passwordHash = await hashPassword(password);
        if (passwordHash !== storedProfile.passwordHash) {
          throw new Error('Неверный пароль.');
        }

        const updatedProfile = mergeWithTelegramData(storedProfile, pendingTelegramUser);

        useBalanceStore.getState().setActiveUser(updatedProfile.id);

        set(state => ({
          user: updatedProfile,
          profiles: {
            ...state.profiles,
            [pendingProfileKey]: updatedProfile
          },
          activeProfileKey: pendingProfileKey,
          isInitialized: true,
          needsProfileSetup: false,
          authMode: null,
          pendingTelegramUser: null,
          pendingProfileKey: null
        }));
      },
      logout: () => {
        const currentUser = get().user;
        useBalanceStore.getState().setActiveUser(null);

        if (currentUser?.telegramId) {
          const profileKey = buildTelegramProfileKey(currentUser.telegramId);
          set(state => ({
            user: null,
            activeProfileKey: null,
            isInitialized: true,
            needsProfileSetup: true,
            authMode: 'login',
            pendingTelegramUser: null,
            pendingProfileKey: state.profiles[profileKey] ? profileKey : null
          }));
          return;
        }

        set({
          user: null,
          activeProfileKey: null,
          isInitialized: true,
          needsProfileSetup: true,
          authMode: null,
          pendingTelegramUser: null,
          pendingProfileKey: null
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

          const referralEarnings = state.user.referrer ? spentAmount * state.user.referrer.commissionRate : 0;

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
        })
    }),
    {
      name: 'boost-user-store',
      version: 3,
      migrate: () => ({
        ...baseState,
        needsProfileSetup: true
      })
    }
  )
);
