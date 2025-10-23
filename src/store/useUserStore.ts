import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { INITIAL_BALANCE, REFERRAL_PERCENTAGE } from '../utils/constants';
import type { TelegramWebAppUser } from '../types/telegram';
import type { UserProfile } from '../types/models';
import { useBalanceStore } from './useBalanceStore';
import { hashPassword } from '../utils/security';
import { environment, resolveManualTelegramUser } from '../utils/environment';
import { fetchUserProfile, syncUserProfile } from '../utils/api';

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
  registerWithPassword: (payload: { password: string; username?: string; fullName?: string }) => Promise<void>;
  loginWithPassword: (payload: { password: string }) => Promise<void>;
  logout: () => void;
  setUserFromServer: (profile: UserProfile) => void;
  syncProfile: () => Promise<void>;
  adjustBalance: (amount: number) => void;
  recordTopUp: (amount: number) => void;
  addReferralEarnings: (amount: number) => void;
  setReferrer: (fullName: string) => void;
  incrementReferrals: () => void;
}

export const MANUAL_PROFILE_KEY = 'manual-profile';

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

        const manualTelegramUser = environment.allowManualOnboarding ? resolveManualTelegramUser() : null;
        const effectiveTelegramUser = telegramUser ?? manualTelegramUser;

        if (user && activeProfileKey) {
          const updatedUser = effectiveTelegramUser?.id === user.telegramId ? mergeWithTelegramData(user, effectiveTelegramUser) : user;
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
          void (async () => {
            try {
              const remoteProfile = await fetchUserProfile(updatedUser.id);
              if (remoteProfile) {
                const merged = effectiveTelegramUser?.id
                  ? mergeWithTelegramData(remoteProfile, effectiveTelegramUser)
                  : remoteProfile;
                set(current => {
                  if (!current.activeProfileKey) {
                    return current;
                  }

                  return {
                    ...current,
                    user: merged,
                    profiles: {
                      ...current.profiles,
                      [current.activeProfileKey]: merged
                    }
                  };
                });
              } else {
                await syncUserProfile(updatedUser);
              }
            } catch (error) {
              console.error('[user] Failed to refresh profile from server', error);
            }
          })();
          return;
        }

        useBalanceStore.getState().setActiveUser(null);

        if (effectiveTelegramUser) {
          const profileKey = buildTelegramProfileKey(effectiveTelegramUser.id);
          const existingProfile = profiles[profileKey];

          if (existingProfile) {
            const syncedProfile = mergeWithTelegramData(existingProfile, effectiveTelegramUser);
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
              pendingTelegramUser: effectiveTelegramUser,
              pendingProfileKey: profileKey
            });
            return;
          }

          set({
            user: null,
            activeProfileKey: null,
            isInitialized: true,
            needsProfileSetup: true,
            authMode: 'register',
            pendingTelegramUser: effectiveTelegramUser,
            pendingProfileKey: profileKey
          });
          return;
        }

        const manualProfile = profiles[MANUAL_PROFILE_KEY];

        set({
          user: null,
          activeProfileKey: null,
          isInitialized: true,
          needsProfileSetup: true,
          authMode: manualProfile ? 'login' : 'register',
          pendingTelegramUser: null,
          pendingProfileKey: MANUAL_PROFILE_KEY
        });
      },
      registerWithPassword: async ({ password, username, fullName }) => {
        const { pendingProfileKey, pendingTelegramUser } = get();

        if (!pendingProfileKey) {
          throw new Error('Регистрация недоступна. Перезапустите приложение.');
        }

        if (!password || password.length < 6) {
          throw new Error('Пароль должен содержать не менее 6 символов.');
        }

        if (pendingTelegramUser) {
          const telegramUsernameRaw = sanitizeUsername(pendingTelegramUser.username);
          if (!telegramUsernameRaw) {
            throw new Error('У вашего Telegram аккаунта отсутствует имя пользователя.');
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

          await syncUserProfile(newUser);

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
          return;
        }

        const normalizedUsername = sanitizeUsername(username);
        if (!normalizedUsername) {
          throw new Error('Укажите имя пользователя.');
        }

        const passwordHash = await hashPassword(password);
        const referralCode = crypto.randomUUID().split('-')[0];
        const safeFullName = fullName?.trim() || normalizedUsername;

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
          firstName: safeFullName.split(' ')[0] || normalizedUsername,
          lastName: undefined,
          fullName: safeFullName,
          username: normalizedUsername,
          telegramId: undefined,
          avatarUrl: buildAvatarUrl(normalizedUsername),
          passwordHash,
          referrer: undefined
        };

        await syncUserProfile(newUser);

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

        let updatedProfile = mergeWithTelegramData(storedProfile, pendingTelegramUser);

        try {
          const remoteProfile = await fetchUserProfile(updatedProfile.id);
          if (remoteProfile) {
            updatedProfile = mergeWithTelegramData(remoteProfile, pendingTelegramUser);
          } else {
            await syncUserProfile(updatedProfile);
          }
        } catch (error) {
          console.error('[user] Failed to synchronize profile during login', error);
        }

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
        const state = get();
        const currentUser = state.user;
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

        const manualProfile = state.profiles[MANUAL_PROFILE_KEY];

        set({
          user: null,
          activeProfileKey: null,
          isInitialized: true,
          needsProfileSetup: true,
          authMode: manualProfile ? 'login' : 'register',
          pendingTelegramUser: null,
          pendingProfileKey: MANUAL_PROFILE_KEY
        });
      },
      setUserFromServer: profile => {
        useBalanceStore.getState().setActiveUser(profile.id);

        set(state => {
          if (!state.activeProfileKey) {
            return state;
          }

          return {
            ...state,
            user: profile,
            profiles: {
              ...state.profiles,
              [state.activeProfileKey]: profile
            }
          };
        });
      },
      syncProfile: async () => {
        const current = get().user;
        if (!current) {
          return;
        }

        try {
          await syncUserProfile(current);
        } catch (error) {
          console.error('[user] Failed to sync profile', error);
        }
      },
      adjustBalance: amount => {
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: Math.max(0, current.balance + amount)
          }));
        });
        void get().syncProfile();
      },
      recordTopUp: amount => {
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
        });
        void get().syncProfile();
      },
      addReferralEarnings: amount => {
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            balance: current.balance + amount,
            referralEarnings: current.referralEarnings + amount
          }));
        });
        void get().syncProfile();
      },
      setReferrer: fullName => {
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
        });
        void get().syncProfile();
      },
      incrementReferrals: () => {
        set(state => {
          if (!state.user || !state.activeProfileKey) return state;

          return withUpdatedActiveProfile(state, current => ({
            ...current,
            referralsCount: current.referralsCount + 1
          }));
        });
        void get().syncProfile();
      }
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
