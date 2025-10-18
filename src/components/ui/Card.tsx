import type { PropsWithChildren, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  title?: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
}

export const Card = ({ title, children, className, headerExtra }: PropsWithChildren<CardProps>) => (
  <div className={clsx('card', className)}>
    {(title || headerExtra) && (
      <div className="order-card-header" style={{ marginBottom: '16px' }}>
        {title && <div className="card-title">{title}</div>}
        {headerExtra}
      </div>
    )}
    {children}
  </div>
);
