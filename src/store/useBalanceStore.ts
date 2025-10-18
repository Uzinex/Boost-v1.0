import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type BalanceEventType = 'topup' | 'spend' | 'earn' | 'referral';

export interface BalanceEvent {
  id: string;
  type: BalanceEventType;
  amount: number;
  description: string;
  createdAt: string;
}

interface BalanceStore {
  history: BalanceEvent[];
  activeUserId: string | null;
  historyByUser: Record<string, BalanceEvent[]>;
  setActiveUser: (userId: string | null) => void;
  logEvent: (userId: string, event: Omit<BalanceEvent, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  getSummaryByType: (userId: string, type: BalanceEventType) => number;
}

type BalanceState = { historyByUser: Record<string, BalanceEvent[]>; activeUserId: string | null };

const storage = createJSONStorage<BalanceState>(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  };
});

export const useBalanceStore = create<BalanceStore>()(
  persist(
    (set, get) => ({
      history: [],
      activeUserId: null,
      historyByUser: {},
      setActiveUser: userId =>
        set(state => ({
          activeUserId: userId,
          history: userId ? state.historyByUser[userId] ?? [] : []
        })),
      logEvent: (userId, event) => {
        if (!userId) {
          return;
        }

        const entry: BalanceEvent = {
          id: crypto.randomUUID(),
          type: event.type,
          amount: event.amount,
          description: event.description,
          createdAt: event.createdAt ?? new Date().toISOString()
        };

        set(state => {
          const previous = state.historyByUser[userId] ?? [];
          const updated = [entry, ...previous].slice(0, 100);
          const isActive = state.activeUserId === userId;

          return {
            historyByUser: {
              ...state.historyByUser,
              [userId]: updated
            },
            history: isActive ? updated : state.history
          };
        });
      },
      getSummaryByType: (userId, type) => {
        const history = get().historyByUser[userId] ?? [];
        return history.filter(item => item.type === type).reduce((total, item) => total + item.amount, 0);
      }
    }),
    {
      name: 'boost-balance-store',
      storage,
      partialize: state => ({ historyByUser: state.historyByUser, activeUserId: state.activeUserId }),
      onRehydrateStorage: () => state => {
        if (state) {
          const activeUserId = state.activeUserId;
          state.history = activeUserId ? state.historyByUser[activeUserId] ?? [] : [];
        }
      }
    }
  )
);
