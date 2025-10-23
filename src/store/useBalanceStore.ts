import { create } from 'zustand';

import type { BalanceEvent, BalanceEventType } from '../types/models';
import { fetchActivityHistory } from '../utils/api';

interface BalanceStore {
  history: BalanceEvent[];
  activeUserId: string | null;
  historyByUser: Record<string, BalanceEvent[]>;
  setActiveUser: (userId: string | null) => void;
  loadHistory: (userId: string) => Promise<void>;
  logEvent: (userId: string, event: Omit<BalanceEvent, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  getSummaryByType: (userId: string, type: BalanceEventType) => number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

const clampHistory = (events: BalanceEvent[]) => events.slice(0, 100);

export const useBalanceStore = create<BalanceStore>((set, get) => ({
  history: [],
  activeUserId: null,
  historyByUser: {},
  setActiveUser: userId => {
    set(state => ({
      activeUserId: userId,
      history: userId ? state.historyByUser[userId] ?? [] : []
    }));

    if (userId) {
      void get().loadHistory(userId);
    }
  },
  loadHistory: async userId => {
    try {
      const payload = await fetchActivityHistory(userId);
      set(state => ({
        historyByUser: {
          ...state.historyByUser,
          [userId]: clampHistory(payload.history)
        },
        history: state.activeUserId === userId ? clampHistory(payload.history) : state.history
      }));
    } catch (error) {
      console.error('[balance] Failed to load history', error);
    }
  },
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
      const updated = clampHistory([entry, ...previous]);
      const isActive = state.activeUserId === userId;

      return {
        historyByUser: {
          ...state.historyByUser,
          [userId]: updated
        },
        history: isActive ? updated : state.history
      };
    });

    void fetch(`${API_BASE}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, event: entry })
    }).catch(error => {
      console.error('[balance] Failed to persist activity', error);
    });
  },
  getSummaryByType: (userId, type) => {
    const history = get().historyByUser[userId] ?? [];
    return history.filter(item => item.type === type).reduce((total, item) => total + item.amount, 0);
  }
}));
