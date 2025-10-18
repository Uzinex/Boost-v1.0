import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useOrdersStore } from '../store/useOrdersStore';
import { useUserStore } from '../store/useUserStore';
import { useTasksStore } from '../store/useTasksStore';
import { TASK_REWARD } from '../utils/constants';
import { formatNumber, formatUZT } from '../utils/formatters';
import { useToastStore } from '../store/useToastStore';

const TasksPage = () => {
  const orders = useOrdersStore(state => state.orders);
  const user = useUserStore(state => state.user);
  const hasCompleted = useTasksStore(state => state.hasCompleted);
  const completeTask = useTasksStore(state => state.completeTask);
  const pushToast = useToastStore(state => state.push);

  if (!user) {
    return null;
  }

  const availableOrders = orders.filter(order => order.status !== 'completed');

  const handleComplete = (orderId: string) => {
    try {
      completeTask(orderId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось завершить задание';
      pushToast({ type: 'error', title: 'Ошибка', description: message });
    }
  };

  return (
    <div className="grid" style={{ gap: '24px' }}>
      <Card title="Как это работает?">
        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Выберите задание из списка ниже, откройте ссылку на канал или группу и подпишитесь. После проверки бот
          начислит вознаграждение. Если продвижение требует предоставить администраторские права боту — заказчик
          обязан добавить бота в администраторы.
        </p>
      </Card>

      <section>
        <h2 className="section-title">Доступные задания</h2>
        {availableOrders.length ? (
          <div className="orders-grid">
            {availableOrders.map(order => {
              const reward = TASK_REWARD[order.type];
              const remaining = order.requestedCount - order.completedCount;
              const isOwnOrder = order.ownerId === user.id;
              const alreadyCompleted = hasCompleted(order.id);

              return (
                <Card key={order.id} className="task-card">
                  <div className="task-meta">
                    <img src={order.ownerAvatar} alt={order.ownerName} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{order.ownerName}</div>
                      {order.ownerUsername && (
                        <small style={{ color: '#6b7280' }}>@{order.ownerUsername}</small>
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>{order.type === 'channel' ? 'Подписка на канал' : 'Вступление в группу'}</strong>
                    <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>{order.link}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge">Вознаграждение: {formatUZT(reward, 1)}</span>
                    <span style={{ color: '#4b5563', fontSize: '0.9rem' }}>Осталось {formatNumber(remaining)} мест</span>
                  </div>
                  <div className="task-actions">
                    <a className="link-button" href={order.link} target="_blank" rel="noreferrer">
                      Открыть {order.type === 'channel' ? 'канал' : 'группу'}
                    </a>
                    <Button
                      type="button"
                      onClick={() => handleComplete(order.id)}
                      disabled={isOwnOrder || alreadyCompleted}
                      title={isOwnOrder ? 'Вы автор заказа' : alreadyCompleted ? 'Вы уже выполнили это задание' : undefined}
                    >
                      {isOwnOrder ? 'Ваш заказ' : alreadyCompleted ? 'Задание выполнено' : 'Подтвердить выполнение'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Заданий нет</strong>
            <span>Как только другие пользователи создадут заказы, они появятся здесь</span>
          </div>
        )}
      </section>
    </div>
  );
};

export default TasksPage;
