import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { TASK_REWARD } from '../utils/constants';
import { useOrdersStore } from './useOrdersStore';
import { useToastStore } from './useToastStore';
import { useUserStore } from './useUserStore';
import { useBalanceStore } from './useBalanceStore';

interface TasksStore {
  completedByUser: Record<string, Record<string, string>>;
  completeTask: (orderId: string) => void;
  hasCompleted: (orderId: string) => boolean;
}

type TasksState = { completedByUser: Record<string, Record<string, string>> };

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
      completedByUser: {},
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

        const reward = TASK_REWARD[order.type];
        const referralCommission = useUserStore.getState().recordTaskCompletion(reward);

        incrementCompletion(orderId);

        set(state => ({
          completedByUser: {
            ...state.completedByUser,
            [currentUser.id]: {
              ...completedForUser,
              [orderId]: new Date().toISOString()
            }
          }
        }));

        useBalanceStore.getState().logEvent(currentUser.id, {
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
      hasCompleted: orderId => {
        const currentUser = useUserStore.getState().user;
        if (!currentUser) {
          return false;
        }

        return Boolean(get().completedByUser[currentUser.id]?.[orderId]);
      }
    }),
    {
      name: 'boost-tasks-store',
      storage,
      partialize: state => ({ completedByUser: state.completedByUser })
    }
  )
);
