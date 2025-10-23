import type {
  BalanceEvent,
  CreateOrderPayload,
  Order,
  UserProfile
} from '../types/models';

interface CreateOrderRequest {
  userId: string;
  payload: CreateOrderPayload & { requestedCount: number };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

type RequestOptions = RequestInit & { skipError?: boolean };

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { skipError, headers, body, ...rest } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body,
    ...rest
  });

  if (!response.ok) {
    if (skipError) {
      throw new Error('Request failed');
    }

    let message = 'Произошла ошибка при запросе к серверу';
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch (error) {
      // ignore
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const syncUserProfile = async (profile: UserProfile) => {
  await request<void>('/users/sync', {
    method: 'POST',
    body: JSON.stringify({ profile })
  });
};

export const fetchUserProfile = async (id: string): Promise<UserProfile | null> => {
  try {
    const payload = await request<{ profile: UserProfile }>(`/users/${id}`, { method: 'GET' });
    return payload.profile;
  } catch (error) {
    console.debug('[api] user profile not found', error);
    return null;
  }
};

export const fetchActivityHistory = async (userId: string) =>
  request<{ history: BalanceEvent[] }>(`/activity/${userId}`, { method: 'GET' });

export const fetchOrders = async () => request<{ orders: Order[] }>('/orders', { method: 'GET' });

export const createOrder = async (payload: CreateOrderRequest) =>
  request<{ order: Order; user: UserProfile }>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const completeOrder = async (
  orderId: string,
  body: { userId: string; telegramId?: number }
) =>
  request<{
    order: Order;
    user: UserProfile;
    reward: number;
    referralCommission: number;
    completedAt: string;
  }>(`/orders/${orderId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const fetchTaskCompletions = async (userId: string) =>
  request<{ completions: Array<{ orderId: string; completedAt: string }> }>(
    `/task-completions/${userId}`,
    { method: 'GET' }
  );

export const persistActivityEvent = async (userId: string, event: BalanceEvent) =>
  request<void>('/activity', {
    method: 'POST',
    body: JSON.stringify({ userId, event }),
    skipError: true
  });
