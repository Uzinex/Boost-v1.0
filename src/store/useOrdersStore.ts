import { create } from 'zustand';

import { ORDER_PRICING } from '../utils/constants';
import type { CreateOrderPayload, Order } from '../types/models';
import { useUserStore } from './useUserStore';
import { useToastStore } from './useToastStore';
import { useBalanceStore } from './useBalanceStore';
import { createOrder as createOrderRequest, fetchOrders as fetchOrdersRequest } from '../utils/api';

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
      const payload = await fetchOrdersRequest();
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

    const data = await createOrderRequest({
      userId: user.id,
      payload: {
        ...payload,
        requestedCount
      }
    });

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
