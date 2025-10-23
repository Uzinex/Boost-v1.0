import { create } from 'zustand';

import { useOrdersStore } from './useOrdersStore';
import { useToastStore } from './useToastStore';
import { useUserStore } from './useUserStore';
import { useBalanceStore } from './useBalanceStore';
import type { Order, UserProfile } from '../types/models';

interface TasksStore {
  completedByUser: Record<string, Record<string, string>>;
  loadForUser: (userId: string) => Promise<void>;
  completeTask: (orderId: string) => Promise<void>;
  hasCompleted: (orderId: string) => boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const useTasksStore = create<TasksStore>((set, get) => ({
  completedByUser: {},
  loadForUser: async userId => {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/task-completions/${userId}`);
      if (!response.ok) {
        throw new Error('Не удалось загрузить выполненные задания');
      }

      const payload = (await response.json()) as {
        completions: Array<{ orderId: string; completedAt: string }>;
      };

      const entries = payload.completions.reduce<Record<string, string>>((acc, item) => {
        acc[item.orderId] = item.completedAt;
        return acc;
      }, {});

      set(state => ({
        completedByUser: {
          ...state.completedByUser,
          [userId]: entries
        }
      }));
    } catch (error) {
      console.error('[tasks] Failed to load completions', error);
    }
  },
  completeTask: async orderId => {
    const { orders, applyOrderUpdate } = useOrdersStore.getState();
    const order = orders.find(item => item.id === orderId);
    if (!order) {
      throw new Error('Задание не найдено');
    }

    const currentUser = useUserStore.getState().user;
    if (currentUser?.id === order.ownerId) {
      throw new Error('Вы не можете выполнять собственные задания');
    }

    if (!currentUser) {
      throw new Error('Не удалось определить пользователя');
    }

    if (order.status === 'completed') {
      throw new Error('Задание уже завершено');
    }

    const completedForUser = get().completedByUser[currentUser.id] ?? {};

    if (completedForUser[orderId]) {
      throw new Error('Вы уже выполнили это задание');
    }

    const response = await fetch(`${API_BASE}/orders/${orderId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        telegramId: currentUser.telegramId
      })
    });

    if (!response.ok) {
      const { error } = (await response.json().catch(() => ({ error: 'Не удалось завершить задание' }))) as {
        error?: string;
      };
      throw new Error(error ?? 'Не удалось завершить задание');
    }

    const payload = (await response.json()) as {
      order: Order;
      user: UserProfile;
      reward: number;
      referralCommission: number;
      completedAt: string;
    };

    applyOrderUpdate(payload.order);
    useUserStore.getState().setUserFromServer(payload.user);

    set(state => ({
      completedByUser: {
        ...state.completedByUser,
        [currentUser.id]: {
          ...completedForUser,
          [orderId]: payload.completedAt
        }
      }
    }));

    useBalanceStore.getState().logEvent(currentUser.id, {
      type: 'earn',
      amount: payload.reward,
      description: `Выполнено задание (${order.type === 'channel' ? 'канал' : 'группа'})`
    });

    const description = payload.referralCommission
      ? `Начислено ${payload.reward.toFixed(1)} UZT (+${payload.referralCommission.toFixed(1)} UZT вашему пригласителю)`
      : `Начислено ${payload.reward.toFixed(1)} UZT`;

    useToastStore
      .getState()
      .push({
        type: 'success',
        title: 'Задание выполнено',
        description
      });
  },
  hasCompleted: orderId => {
    const currentUser = useUserStore.getState().user;
    if (!currentUser) {
      return false;
    }

    return Boolean(get().completedByUser[currentUser.id]?.[orderId]);
  }
}));
