import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Главная' },
  { to: '/orders', label: 'Мои заказы' },
  { to: '/tasks', label: 'Задания' },
  { to: '/profile', label: 'Профиль' }
];

export const Sidebar = () => (
  <aside className="sidebar">
    <div className="logo">Boost</div>
    <nav>
      {navItems.map(item => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)} end>
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
);
