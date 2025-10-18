import { useEffect } from 'react';
import { useToastStore } from '../../store/useToastStore';

export const ToastContainer = () => {
  const toasts = useToastStore(state => state.toasts);
  const remove = useToastStore(state => state.remove);

  useEffect(() => {
    const timers = toasts.map(toast => setTimeout(() => remove(toast.id), 4000));
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [toasts, remove]);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div>{toast.title}</div>
          {toast.description && <small style={{ opacity: 0.8 }}>{toast.description}</small>}
        </div>
      ))}
    </div>
  );
};
