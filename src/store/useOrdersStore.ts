import { create } from 'zustand';

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
}

export interface CreateOrderPayload {
  type: OrderType;
  requestedCount: number;
  link: string;
}

interface OrdersStore {
  orders: Order[];
  createOrder: (payload: CreateOrderPayload) => Order;
  incrementCompletion: (orderId: string) => void;
  getOrdersByOwner: (ownerId: string) => Order[];
}

const seededOrders: Order[] = [
  {
    id: 'order-seed-1',
    ownerId: 'seed-1',
    ownerName: 'Алишер Юсупов',
    ownerUsername: 'alisher_pro',
    ownerAvatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=alisher',
    type: 'channel',
    link: 'https://t.me/uzinex_channel',
    requestedCount: 150,
    completedCount: 45,
    pricePerUnit: ORDER_PRICING.channel,
    totalBudget: 150 * ORDER_PRICING.channel,
    status: 'active',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
  },
  {
    id: 'order-seed-2',
    ownerId: 'seed-2',
    ownerName: 'Нилуфар Сафарова',
    ownerUsername: 'nilufar',
    ownerAvatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=nilufar',
    type: 'group',
    link: 'https://t.me/marketing_uz',
    requestedCount: 80,
    completedCount: 32,
    pricePerUnit: ORDER_PRICING.group,
    totalBudget: 80 * ORDER_PRICING.group,
    status: 'active',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString()
  },
  {
    id: 'order-seed-3',
    ownerId: 'seed-3',
    ownerName: 'Jamshid Web',
    ownerUsername: 'jamshid_dev',
    ownerAvatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=jamshid',
    type: 'channel',
    link: 'https://t.me/frontend_lab',
    requestedCount: 220,
    completedCount: 220,
    pricePerUnit: ORDER_PRICING.channel,
    totalBudget: 220 * ORDER_PRICING.channel,
    status: 'completed',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
  }
];

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  orders: seededOrders,
  createOrder: payload => {
    const user = useUserStore.getState().user;
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const { type } = payload;
    const link = payload.link.trim();
    const requestedCount = Math.max(10, Math.floor(payload.requestedCount));
    const pricePerUnit = ORDER_PRICING[type];
    const totalBudget = requestedCount * pricePerUnit;

    if (user.balance < totalBudget) {
      throw new Error('Недостаточно средств на балансе');
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
      createdAt: new Date().toISOString()
    };

    set(state => ({ orders: [newOrder, ...state.orders] }));

    useBalanceStore.getState().logEvent({
      type: 'spend',
      amount: totalBudget,
      description: `Создан заказ (${type === 'channel' ? 'канал' : 'группа'}) на ${requestedCount} подписчиков`
    });

    useToastStore
      .getState()
      .push({
        type: 'success',
        title: 'Заказ создан',
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
}));
