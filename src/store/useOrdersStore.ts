import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { ORDER_PRICING } from '../utils/constants';
import type { CreateOrderPayload, Order, UserProfile } from '../types/models';
import { useUserStore } from './useUserStore';
import { useToastStore } from './useToastStore';
import { useBalanceStore } from './useBalanceStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

interface OrdersStore {
  orders: Order[];
  isLoading: boolean;
  hasLoaded: boolean;
  loadOrders: (force?: boolean) => Promise<void>;
  createOrder: (payload: CreateOrderPayload) => Promise<Order>;
  applyOrderUpdate: (order: Order) => void;
  getOrdersByOwner: (ownerId: string) => Order[];
}

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  orders: [],
  isLoading: false,
  hasLoaded: false,
  loadOrders: async (force = false) => {
    if (get().isLoading || (get().hasLoaded && !force)) {
      return;
    }

    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/orders`);
      if (!response.ok) {
        throw new Error('Не удалось загрузить заказы');
      }

      const payload = (await response.json()) as { orders: Order[] };
      set({ orders: payload.orders, isLoading: false, hasLoaded: true });
    } catch (error) {
      console.error('[orders] Failed to load orders', error);
      set({ isLoading: false });
      throw error;
    }
  },
  createOrder: async payload => {
    const user = useUserStore.getState().user;
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const requestedCount = Math.max(10, Math.floor(payload.requestedCount));
    const pricePerUnit = ORDER_PRICING[payload.type];
    const totalBudget = requestedCount * pricePerUnit;

    if (user.balance < totalBudget) {
      throw new Error('Недостаточно средств на балансе');
    }

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          ...payload,
          requestedCount,
          totalBudget
        },
        userId: user.id
      })
    });

    if (!response.ok) {
      const { error } = (await response.json().catch(() => ({ error: 'Не удалось создать заказ' }))) as {
        error?: string;
      };
      throw new Error(error ?? 'Не удалось создать заказ');
    }

    const data = (await response.json()) as { order: Order; user: UserProfile };

    set(state => ({
      orders: [data.order, ...state.orders],
      hasLoaded: true
    }));

    useUserStore.getState().setUserFromServer(data.user);
    useBalanceStore.getState().logEvent(user.id, {
      type: 'spend',
      amount: totalBudget,
      description: `Создан заказ (${payload.type === 'channel' ? 'канал' : 'группа'}) на ${requestedCount} подписчиков`
    });

    useToastStore
      .getState()
      .push({
        type: 'success',
        title: 'Заказ опубликован',
        description: `Списано ${totalBudget.toFixed(1)} UZT`
      });

    return data.order;
  },
  applyOrderUpdate: order => {
    set(state => ({
      orders: state.orders.map(item => (item.id === order.id ? order : item))
    }));
  },
  getOrdersByOwner: ownerId => get().orders.filter(order => order.ownerId === ownerId)
}));
