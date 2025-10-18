import { formatUZT } from '../../utils/formatters';
import { useUserStore } from '../../store/useUserStore';

export const Header = () => {
  const user = useUserStore(state => state.user);

  return (
    <header className="app-header">
      <div>
        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Boost • Telegram WebApp</div>
        <small style={{ color: '#6b7280' }}>Управляйте продвижением и заданиями в одном месте</small>
      </div>
      {user && (
        <div className="user-block">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600 }}>{user.fullName}</div>
            <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600 }}>
              Баланс: {formatUZT(user.balance, 1)}
            </div>
          </div>
          <img src={user.avatarUrl} alt={user.fullName} />
        </div>
      )}
    </header>
  );
};
