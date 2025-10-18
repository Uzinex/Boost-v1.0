import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { TASK_REWARD } from '../utils/constants';
import { useOrdersStore } from './useOrdersStore';
import { useToastStore } from './useToastStore';
import { useUserStore } from './useUserStore';
import { useBalanceStore } from './useBalanceStore';

interface TasksStore {
  completed: Record<string, string>;
  completeTask: (orderId: string) => void;
  hasCompleted: (orderId: string) => boolean;
}

type TasksState = { completed: Record<string, string> };

const storage = createJSONStorage<TasksState>(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  };
});

export const useTasksStore = create<TasksStore>()(
  persist(
    (set, get) => ({
      completed: {},
      completeTask: orderId => {
        const { orders, incrementCompletion } = useOrdersStore.getState();
        const order = orders.find(item => item.id === orderId);
        if (!order) {
          throw new Error('Задание не найдено');
        }

        const currentUser = useUserStore.getState().user;
        if (currentUser?.id === order.ownerId) {
          throw new Error('Вы не можете выполнять собственные задания');
        }

        if (order.status === 'completed') {
          throw new Error('Задание уже завершено');
        }

        if (get().completed[orderId]) {
          throw new Error('Вы уже выполнили это задание');
        }

        const reward = TASK_REWARD[order.type];
        const referralCommission = useUserStore.getState().recordTaskCompletion(reward);

        incrementCompletion(orderId);

        set(state => ({
          completed: {
            ...state.completed,
            [orderId]: new Date().toISOString()
          }
        }));

        useBalanceStore.getState().logEvent({
          type: 'earn',
          amount: reward,
          description: `Выполнено задание (${order.type === 'channel' ? 'канал' : 'группа'})`
        });

        const description = referralCommission
          ? `Начислено ${reward.toFixed(1)} UZT (+${referralCommission.toFixed(1)} UZT вашему пригласителю)`
          : `Начислено ${reward.toFixed(1)} UZT`;

        useToastStore
          .getState()
          .push({
            type: 'success',
            title: 'Задание выполнено',
            description
          });
      },
      hasCompleted: orderId => Boolean(get().completed[orderId])
    }),
    {
      name: 'boost-tasks-store',
      storage,
      partialize: state => ({ completed: state.completed })
    }
  )
);
