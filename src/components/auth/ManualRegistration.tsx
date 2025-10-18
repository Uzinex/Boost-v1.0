import { useState } from 'react';

import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useUserStore } from '../../store/useUserStore';
import { useToastStore } from '../../store/useToastStore';

export const ManualRegistration = () => {
  const completeRegistration = useUserStore(state => state.completeRegistration);
  const pushToast = useToastStore(state => state.push);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      pushToast({ type: 'error', title: 'Укажите ваше имя' });
      return;
    }

    setIsSubmitting(true);
    try {
      completeRegistration({ fullName: trimmedName, username: username.trim() });
      pushToast({ type: 'success', title: 'Профиль создан', description: 'Теперь вы можете пользоваться приложением' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать профиль';
      pushToast({ type: 'error', title: 'Ошибка', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registration-screen">
      <Card className="registration-card" title="Создайте профиль">
        <form onSubmit={handleSubmit} className="grid" style={{ gap: '16px' }}>
          <p style={{ color: '#4b5563', fontSize: '0.95rem' }}>
            Мы не получили данные вашего Telegram аккаунта. Заполните информацию ниже, чтобы создать профиль и
            продолжить работу в приложении.
          </p>
          <Input
            id="fullName"
            label="Ваше имя"
            placeholder="Иван Иванов"
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            autoComplete="name"
            required
          />
          <Input
            id="username"
            label="Telegram логин"
            placeholder="@username"
            value={username}
            onChange={event => setUsername(event.target.value)}
            autoComplete="username"
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Создание...' : 'Продолжить'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
