import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: ToastMessage[];
  push: (toast: Omit<ToastMessage, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>(set => ({
  toasts: [],
  push: toast =>
    set(state => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: crypto.randomUUID()
        }
      ]
    })),
  remove: id =>
    set(state => ({
      toasts: state.toasts.filter(toast => toast.id !== id)
    }))
}));
