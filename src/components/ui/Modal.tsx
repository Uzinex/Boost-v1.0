import type { PropsWithChildren } from 'react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
}

export const Modal = ({ isOpen, onClose, children, title, width = 420 }: PropsWithChildren<ModalProps>) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className={clsx('card')}
        style={{ width: '100%', maxWidth: width }}
        onClick={event => event.stopPropagation()}
      >
        {title && <div className="card-title" style={{ marginBottom: '16px' }}>{title}</div>}
        {children}
      </div>
    </div>
  );
};
