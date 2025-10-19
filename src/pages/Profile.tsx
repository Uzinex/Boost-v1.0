import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useUserStore } from '../store/useUserStore';
import { formatNumber, formatUZT } from '../utils/formatters';
import { TOPUP_TIERS } from '../utils/constants';
import { openTelegramLink } from '../utils/telegram';

const ProfilePage = () => {
  const user = useUserStore(state => state.user);

  if (!user) {
    return null;
  }

  return (
    <div className="grid" style={{ gap: '24px' }}>
      <Card>
        <div className="profile-header">
          <img src={user.avatarUrl} alt={user.fullName} />
          <div>
            <h1>{user.fullName}</h1>
            {user.username && <div style={{ color: '#6b7280' }}>@{user.username}</div>}
            <div className="tag-pill" style={{ marginTop: '8px' }}>
              Баланс: {formatUZT(user.balance, 1)}
            </div>
          </div>
        </div>

        <table className="info-table">
          <tbody>
            <tr>
              <td>Всего заказов</td>
              <td>{formatNumber(user.ordersPlaced)}</td>
            </tr>
            <tr>
              <td>Выполнено заданий</td>
              <td>{formatNumber(user.tasksCompleted)}</td>
            </tr>
            <tr>
              <td>Рефералы</td>
              <td>
                {formatNumber(user.referralsCount)} пользователей · заработано {formatUZT(user.referralEarnings, 1)}
              </td>
            </tr>
            <tr>
              <td>Создан аккаунт</td>
              <td>{new Date(user.createdAt).toLocaleString('ru-RU')}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Пополнение баланса">
        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Для пополнения напишите администратору <strong>@feruzdilov</strong>. Укажите желаемую сумму и ваш логин, а также
          предоставьте боту права администратора в продвигаемом канале или группе для корректного учёта подписок.
        </p>
        <Button
          type="button"
          style={{ marginTop: '16px', alignSelf: 'flex-start', display: 'inline-flex' }}
          onClick={() => openTelegramLink('@feruzdilov')}
        >
          Написать администратору
        </Button>
      </Card>

      <Card title="Тарифы на пополнение">
        <table className="rate-table">
          <thead>
            <tr>
              <th>Сумма пополнения</th>
              <th>Стоимость 1 UZT</th>
            </tr>
          </thead>
          <tbody>
            {TOPUP_TIERS.map(tier => (
              <tr key={tier.min}>
                <td>
                  {tier.max === Infinity
                    ? `От ${formatNumber(tier.min)} UZT`
                    : `${formatNumber(tier.min)} — ${formatNumber(tier.max)} UZT`}
                </td>
                <td>{tier.rate} сум</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '0.85rem', color: '#6b7280' }}>
          Минимальная сумма пополнения — 1000 UZT. Все операции проводятся вручную администратором.
        </p>
      </Card>
    </div>
  );
};

export default ProfilePage;
