import { useMemo, useState } from 'react';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useOrdersStore } from '../store/useOrdersStore';
import { useUserStore } from '../store/useUserStore';
import { formatNumber, formatUZT } from '../utils/formatters';
import { ORDER_PRICING, type OrderType } from '../utils/constants';
import { useToastStore } from '../store/useToastStore';

const OrdersPage = () => {
  const orders = useOrdersStore(state => state.orders);
  const createOrder = useOrdersStore(state => state.createOrder);
  const user = useUserStore(state => state.user);
  const pushToast = useToastStore(state => state.push);

  const [type, setType] = useState<OrderType>('channel');
  const [requestedCount, setRequestedCount] = useState(100);
  const [link, setLink] = useState('');

  const myOrders = useMemo(() => (user ? orders.filter(order => order.ownerId === user.id) : []), [orders, user]);
  const completedOrders = myOrders.filter(order => order.status === 'completed');
  const activeOrders = myOrders.filter(order => order.status !== 'completed');

  const pricePerUnit = ORDER_PRICING[type];
  const totalCost = requestedCount * pricePerUnit;
  const remainingBalance = user ? user.balance : 0;
  const canAfford = remainingBalance >= totalCost;
  const isFormValid = canAfford && requestedCount >= 10 && link.includes('t.me');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    if (!link || !link.includes('t.me')) {
      pushToast({ type: 'error', title: 'Неверная ссылка', description: 'Укажите корректную ссылку на канал или группу' });
      return;
    }

    try {
      createOrder({ type, requestedCount, link: link.trim() });
      setLink('');
      pushToast({ type: 'success', title: 'Заказ отправлен на модерацию' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать заказ';
      pushToast({ type: 'error', title: 'Ошибка', description: message });
    }
  };

  return (
    <div className="grid" style={{ gap: '24px' }}>
      <Card title="Новый заказ на продвижение">
        <form onSubmit={handleSubmit} className="grid" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`link-button ${type === 'channel' ? 'active' : ''}`}
              style={
                type === 'channel'
                  ? {
                      background: 'rgba(37, 99, 235, 0.18)',
                      borderColor: '#2563eb',
                      color: '#1d4ed8'
                    }
                  : undefined
              }
              onClick={() => setType('channel')}
            >
              Telegram канал · {ORDER_PRICING.channel} UZT / пользователь
            </button>
            <button
              type="button"
              className={`link-button ${type === 'group' ? 'active' : ''}`}
              style={
                type === 'group'
                  ? {
                      background: 'rgba(16, 185, 129, 0.15)',
                      borderColor: '#10b981',
                      color: '#047857'
                    }
                  : undefined
              }
              onClick={() => setType('group')}
            >
              Telegram группа · {ORDER_PRICING.group} UZT / пользователь
            </button>
          </div>

          <Input
            id="requestedCount"
            type="number"
            min={10}
            step={10}
            label="Количество пользователей"
            value={requestedCount}
            onChange={event => {
              const value = Number(event.target.value);
              setRequestedCount(Number.isNaN(value) ? 0 : value);
            }}
          />

          <Input
            id="link"
            label="Ссылка на канал или группу"
            placeholder="https://t.me/your_channel"
            value={link}
            onChange={event => setLink(event.target.value)}
          />

          <div className="card" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div className="order-card" style={{ gap: '8px' }}>
              <span style={{ fontWeight: 600 }}>Итого к списанию</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatUZT(totalCost, 1)}</div>
              <span style={{ fontSize: '0.85rem', color: canAfford ? '#047857' : '#ef4444' }}>
                {canAfford ? `Баланс после заказа: ${formatUZT(remainingBalance - totalCost, 1)}` : 'Недостаточно средств'}
              </span>
            </div>
          </div>

          <Button type="submit" disabled={!isFormValid}>
            Создать заказ и списать {formatUZT(totalCost, 1)}
          </Button>
        </form>
      </Card>

      <section>
        <h2 className="section-title">Активные заказы</h2>
        {activeOrders.length ? (
          <div className="orders-grid">
            {activeOrders.map(order => {
              const completion = Math.round((order.completedCount / order.requestedCount) * 100);
              const remaining = order.requestedCount - order.completedCount;
              return (
                <Card
                  key={order.id}
                  title={`${order.type === 'channel' ? 'Канал' : 'Группа'} · ${order.link}`}
                  className="order-card"
                >
                  <div className="order-card-header">
                    <span className="badge">Создан: {new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
                    <span style={{ fontWeight: 600 }}>{formatUZT(order.totalBudget, 1)}</span>
                  </div>
                  <div className="order-progress">
                    <div className="order-progress-bar" style={{ width: `${completion}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563', fontSize: '0.9rem' }}>
                    <span>
                      Привлечено {formatNumber(order.completedCount)} / {formatNumber(order.requestedCount)}
                    </span>
                    <span>Осталось {formatNumber(remaining)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Активных заказов нет</strong>
            <span>Создайте заказ выше, чтобы привлечь новую аудиторию</span>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Завершённые заказы</h2>
        {completedOrders.length ? (
          <div className="orders-grid">
            {completedOrders.map(order => (
              <Card key={order.id} title={`${order.type === 'channel' ? 'Канал' : 'Группа'} · ${order.link}`}>
                <div className="order-card">
                  <div className="order-card-header">
                    <span className="badge">Завершён: {new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
                    <span style={{ fontWeight: 600 }}>{formatUZT(order.totalBudget, 1)}</span>
                  </div>
                  <div style={{ color: '#4b5563', fontSize: '0.9rem' }}>
                    Заказано {formatNumber(order.requestedCount)} пользователей
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Завершённых заказов пока нет</strong>
            <span>После выполнения заказов они появятся здесь</span>
          </div>
        )}
      </section>
    </div>
  );
};

export default OrdersPage;
