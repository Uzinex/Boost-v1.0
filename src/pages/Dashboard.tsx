import { Card } from '../components/ui/Card';
import { useUserStore } from '../store/useUserStore';
import { useOrdersStore } from '../store/useOrdersStore';
import { formatNumber, formatUZT } from '../utils/formatters';
import { useBalanceStore } from '../store/useBalanceStore';

const DashboardPage = () => {
  const user = useUserStore(state => state.user);
  const orders = useOrdersStore(state => state.orders);
  const spendSummary = useBalanceStore(state => state.getSummaryByType);
  const history = useBalanceStore(state => state.history);

  if (!user) {
    return null;
  }

  const myOrders = orders.filter(order => order.ownerId === user.id);
  const completedOrders = myOrders.filter(order => order.status === 'completed');
  const activeOrders = myOrders.filter(order => order.status !== 'completed');

  const spentOnOrders = myOrders.reduce((total, order) => total + order.totalBudget, 0);
  const earnedFromTasks = spendSummary('earn');
  const referralIncome = user.referralEarnings;
  const totalTopUps = user.totalTopUps;
  const totalTopUpAmount = user.totalTopUpAmount;

  return (
    <div className="grid grid-2">
      <div className="grid grid-3">
        <Card title="Текущий баланс" className="stat-card">
          <div className="card-value">{formatUZT(user.balance, 1)}</div>
          <small>Вы можете размещать заказы или выполнять задания</small>
        </Card>
        <Card title="Заработано за период" className="stat-card">
          <div className="card-value">{formatUZT(user.lifetimeEarned, 1)}</div>
          <small>Вознаграждение за выполненные задания</small>
        </Card>
        <Card title="Потрачено на заказы" className="stat-card">
          <div className="card-value">{formatUZT(spentOnOrders, 1)}</div>
          <small>Общий бюджет на продвижение</small>
        </Card>
        <Card title="Создано заказов" className="stat-card">
          <div className="card-value">{formatNumber(user.ordersPlaced)}</div>
          <small>{formatNumber(activeOrders.length)} активных · {formatNumber(completedOrders.length)} завершённых</small>
        </Card>
        <Card title="Выполнено заданий" className="stat-card">
          <div className="card-value">{formatNumber(user.tasksCompleted)}</div>
          <small>Получено {formatUZT(earnedFromTasks, 1)} за весь период</small>
        </Card>
        <Card title="Пополнения" className="stat-card">
          <div className="card-value">{formatNumber(totalTopUps)}</div>
          <small>На сумму {formatUZT(totalTopUpAmount, 1)}</small>
        </Card>
      </div>

      <div className="grid" style={{ alignSelf: 'flex-start' }}>
        <Card title="Реферальная программа" className="stat-card">
          <div className="card-value">{formatUZT(referralIncome, 1)}</div>
          <small>Вы пригласили {formatNumber(user.referralsCount)} пользователей</small>
          <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>
            Делитесь вашей ссылкой, чтобы получать 10% от доходов друзей. Выданная ссылка отслеживает каждого
            приглашённого.
          </p>
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2563eb' }}>Ваша ссылка:</span>
            <code
              style={{
                background: 'rgba(37, 99, 235, 0.08)',
                color: '#1d4ed8',
                padding: '10px 12px',
                borderRadius: '10px',
                wordBreak: 'break-all'
              }}
            >
              https://t.me/boost_webapp_bot?start={user.referralCode}
            </code>
          </div>
        </Card>
        <Card title="История операций" className="stat-card">
          <small>Последние транзакции на балансе</small>
          {history.length ? (
            <table className="table" style={{ marginTop: '12px' }}>
              <tbody>
                {history.slice(0, 5).map(event => (
                  <tr key={event.id}>
                    <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{new Date(event.createdAt).toLocaleString('ru-RU')}</td>
                    <td>{event.description}</td>
                    <td style={{ fontWeight: 600, color: event.type === 'spend' ? '#ef4444' : '#047857' }}>
                      {event.type === 'spend' ? '-' : '+'}
                      {formatNumber(event.amount, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '12px 0' }}>
              <strong>Операции пока отсутствуют</strong>
              <span>Создайте заказ или выполните задание, чтобы увидеть историю</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
