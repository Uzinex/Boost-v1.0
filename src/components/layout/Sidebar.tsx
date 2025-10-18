import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const navItems = [
  { to: '/', label: 'Главная' },
  { to: '/orders', label: 'Мои заказы' },
  { to: '/tasks', label: 'Задания' },
  { to: '/profile', label: 'Профиль' }
];

interface SidebarProps {
  isMobileOpen: boolean;
  onNavigate?: () => void;
}

export const Sidebar = ({ isMobileOpen, onNavigate }: SidebarProps) => (
  <aside className={clsx('sidebar', isMobileOpen && 'sidebar-open')}>
    <div className="logo">Boost</div>
    <nav>
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (isActive ? 'active' : undefined)}
          end
          onClick={onNavigate}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
);
