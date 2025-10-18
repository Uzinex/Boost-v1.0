import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { ORDER_PRICING, type OrderType } from '../utils/constants';
import { useUserStore } from './useUserStore';
import { useToastStore } from './useToastStore';
import { useBalanceStore } from './useBalanceStore';

export type OrderStatus = 'active' | 'completed';

export interface Order {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerUsername?: string;
  ownerAvatar?: string;
  type: OrderType;
  link: string;
  requestedCount: number;
  completedCount: number;
  pricePerUnit: number;
  totalBudget: number;
  status: OrderStatus;
  createdAt: string;
  botIsAdmin: boolean;
}

export interface CreateOrderPayload {
  type: OrderType;
  requestedCount: number;
  link: string;
  botIsAdmin: boolean;
}

interface OrdersStore {
  orders: Order[];
  createOrder: (payload: CreateOrderPayload) => Order;
  incrementCompletion: (orderId: string) => void;
  getOrdersByOwner: (ownerId: string) => Order[];
}

type OrderStoreState = { orders: Order[] };

const storage = createJSONStorage<OrderStoreState>(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined
  };
});

export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
      orders: [],
      createOrder: payload => {
        const user = useUserStore.getState().user;
        if (!user) {
          throw new Error('Пользователь не найден');
        }

        const { type, botIsAdmin } = payload;
        const link = payload.link.trim();
        const requestedCount = Math.max(10, Math.floor(payload.requestedCount));
        const pricePerUnit = ORDER_PRICING[type];
        const totalBudget = requestedCount * pricePerUnit;

        if (user.balance < totalBudget) {
          throw new Error('Недостаточно средств на балансе');
        }

        if (!botIsAdmin) {
          throw new Error('Добавьте бота в администраторы продвигаемого канала или группы');
        }

        useUserStore.getState().recordOrder(totalBudget);

        const newOrder: Order = {
          id: crypto.randomUUID(),
          ownerId: user.id,
          ownerName: user.fullName,
          ownerUsername: user.username,
          ownerAvatar: user.avatarUrl,
          type,
          link,
          requestedCount,
          completedCount: 0,
          pricePerUnit,
          totalBudget,
          status: 'active',
          createdAt: new Date().toISOString(),
          botIsAdmin
        };

        set(state => ({ orders: [newOrder, ...state.orders.filter(order => !order.id.startsWith('order-seed-'))] }));

        useBalanceStore.getState().logEvent({
          type: 'spend',
          amount: totalBudget,
          description: `Создан заказ (${type === 'channel' ? 'канал' : 'группа'}) на ${requestedCount} подписчиков`
        });

        useToastStore
          .getState()
          .push({
            type: 'success',
            title: 'Заказ опубликован',
            description: `Списано ${totalBudget.toFixed(1)} UZT`
          });

        return newOrder;
      },
      incrementCompletion: orderId => {
        const { orders } = get();
        const target = orders.find(order => order.id === orderId);
        if (!target) return;

        if (target.completedCount >= target.requestedCount) {
          return;
        }

        const updatedCount = target.completedCount + 1;
        const status: OrderStatus = updatedCount >= target.requestedCount ? 'completed' : 'active';

        set(state => ({
          orders: state.orders.map(order =>
            order.id === orderId
              ? {
                  ...order,
                  completedCount: updatedCount,
                  status
                }
              : order
          )
        }));
      },
      getOrdersByOwner: ownerId => get().orders.filter(order => order.ownerId === ownerId)
    }),
    {
      name: 'boost-orders-store',
      storage,
      partialize: state => ({ orders: state.orders }),
      onRehydrateStorage: () => state => {
        if (state?.orders) {
          state.orders = state.orders.filter(order => !order.id.startsWith('order-seed-'));
        }
      }
    }
  )
);
