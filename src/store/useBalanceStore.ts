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
  logEvent: (event: Omit<BalanceEvent, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  getSummaryByType: (type: BalanceEventType) => number;
}

type BalanceState = { history: BalanceEvent[] };

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
      logEvent: event => {
        const entry: BalanceEvent = {
          id: crypto.randomUUID(),
          type: event.type,
          amount: event.amount,
          description: event.description,
          createdAt: event.createdAt ?? new Date().toISOString()
        };

        set(state => ({
          history: [entry, ...state.history].slice(0, 100)
        }));
      },
      getSummaryByType: type =>
        get().history
          .filter(item => item.type === type)
          .reduce((total, item) => total + item.amount, 0)
    }),
    {
      name: 'boost-balance-store',
      storage,
      partialize: state => ({ history: state.history })
    }
  )
);
