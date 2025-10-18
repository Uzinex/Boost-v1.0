import { create } from 'zustand';

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

export const useTasksStore = create<TasksStore>((set, get) => ({
  completed: {},
  completeTask: orderId => {
    const { orders, incrementCompletion } = useOrdersStore.getState();
    const order = orders.find(item => item.id === orderId);
    if (!order) {
      throw new Error('Задание не найдено');
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
}));
