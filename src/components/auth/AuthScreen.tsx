import { useMemo, useState } from 'react';

import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useUserStore } from '../../store/useUserStore';
import { useToastStore } from '../../store/useToastStore';

const normalizeUsername = (value: string) => value.replace(/^@+/, '').trim().toLowerCase();

const RegistrationForm = () => {
  const telegramUser = useUserStore(state => state.pendingTelegramUser);
  const registerWithPassword = useUserStore(state => state.registerWithPassword);
  const pushToast = useToastStore(state => state.push);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const displayUsername = telegramUser?.username?.replace(/^@+/, '').trim() ?? '';
  const expectedUsername = normalizeUsername(telegramUser?.username ?? '');

  if (!telegramUser) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!expectedUsername) {
      pushToast({ type: 'error', title: 'Укажите username', description: 'В Telegram должен быть установлен @username' });
      return;
    }

    const normalizedInput = normalizeUsername(username);
    if (!normalizedInput || normalizedInput !== expectedUsername) {
      pushToast({
        type: 'error',
        title: 'Неверный логин',
        description: 'Введите ваш Telegram @username без ошибок'
      });
      return;
    }

    if (password.length < 6) {
      pushToast({
        type: 'error',
        title: 'Слишком короткий пароль',
        description: 'Пароль должен содержать минимум 6 символов'
      });
      return;
    }

    if (password !== confirmPassword) {
      pushToast({ type: 'error', title: 'Пароли не совпадают' });
      return;
    }

    setSubmitting(true);
    try {
      await registerWithPassword({ password });
      pushToast({ type: 'success', title: 'Профиль создан', description: 'Добро пожаловать в Boost!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось завершить регистрацию';
      pushToast({ type: 'error', title: 'Ошибка', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="registration-card" title="Создание профиля">
      <form onSubmit={handleSubmit} className="grid" style={{ gap: '16px' }}>
        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Мы обнаружили ваш Telegram аккаунт <strong>@{displayUsername || expectedUsername}</strong>. Для защиты профиля
          установите пароль и
          подтвердите свой логин. Один Telegram-аккаунт соответствует одному профилю в Boost.
        </p>
        <Input
          id="username"
          label="Подтвердите ваш Telegram @username"
          placeholder="@username"
          value={username}
          onChange={event => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
        <Input
          id="password"
          type="password"
          label="Пароль"
          placeholder="Минимум 6 символов"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          id="confirmPassword"
          type="password"
          label="Повторите пароль"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Создаём профиль...' : 'Завершить регистрацию'}
        </Button>
      </form>
    </Card>
  );
};

const LoginForm = () => {
  const pendingProfileKey = useUserStore(state => state.pendingProfileKey);
  const profiles = useUserStore(state => state.profiles);
  const pendingTelegramUser = useUserStore(state => state.pendingTelegramUser);
  const loginWithPassword = useUserStore(state => state.loginWithPassword);
  const pushToast = useToastStore(state => state.push);

  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const profile = useMemo(() => (pendingProfileKey ? profiles[pendingProfileKey] : null), [pendingProfileKey, profiles]);

  const displayUsername = pendingTelegramUser?.username ?? profile?.username ?? '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    try {
      await loginWithPassword({ password });
      pushToast({ type: 'success', title: 'Вход выполнен' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось войти';
      pushToast({ type: 'error', title: 'Ошибка', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="registration-card" title="Введите пароль">
      <form onSubmit={handleSubmit} className="grid" style={{ gap: '16px' }}>
        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Профиль <strong>{profile?.fullName ?? 'пользователя'}</strong>{' '}
          {displayUsername ? `(@${displayUsername}) ` : ''}защищён паролем. Введите пароль, установленный при регистрации, чтобы
          продолжить работу.
        </p>
        <Input
          id="password"
          type="password"
          label="Пароль"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Проверяем...' : 'Войти в профиль'}
        </Button>
      </form>
    </Card>
  );
};

export const AuthScreen = () => {
  const authMode = useUserStore(state => state.authMode);
  const pendingTelegramUser = useUserStore(state => state.pendingTelegramUser);

  if (authMode === 'register') {
    return (
      <div className="registration-screen">
        <RegistrationForm />
      </div>
    );
  }

  if (authMode === 'login') {
    return (
      <div className="registration-screen">
        <LoginForm />
      </div>
    );
  }

  if (pendingTelegramUser && !pendingTelegramUser.username) {
    return (
      <div className="registration-screen">
        <Card className="registration-card" title="Требуется имя пользователя">
          <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Чтобы продолжить, задайте @username в настройках Telegram и перезапустите веб-приложение командой
            <strong> /start</strong> в чате с ботом. Это необходимо для привязки профиля и защиты аккаунта паролем.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="registration-screen">
      <Card className="registration-card" title="Недоступно">
        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Не удалось получить данные аккаунта Telegram. Перезапустите приложение через команду <strong>/start</strong> и
          предоставьте доступ к данным профиля.
        </p>
      </Card>
    </div>
  );
};
