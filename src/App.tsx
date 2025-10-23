import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { ToastContainer } from './components/common/Toast';
import { Loader } from './components/common/Loader';
import DashboardPage from './pages/Dashboard';
import OrdersPage from './pages/Orders';
import TasksPage from './pages/Tasks';
import ProfilePage from './pages/Profile';
import { useUserStore } from './store/useUserStore';
import { getTelegramUser, launchedFromStartCommand } from './utils/telegram';
import { AuthScreen } from './components/auth/AuthScreen';
import { useToastStore } from './store/useToastStore';
import { useOrdersStore } from './store/useOrdersStore';
import { useTasksStore } from './store/useTasksStore';

const App = () => {
  const initialize = useUserStore(state => state.initialize);
  const isInitialized = useUserStore(state => state.isInitialized);
  const needsProfileSetup = useUserStore(state => state.needsProfileSetup);
  const user = useUserStore(state => state.user);
  const pushToast = useToastStore(state => state.push);
  const loadOrders = useOrdersStore(state => state.loadOrders);
  const hasLoadedOrders = useOrdersStore(state => state.hasLoaded);
  const loadTaskCompletions = useTasksStore(state => state.loadForUser);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [welcomeShown, setWelcomeShown] = useState(false);

  useEffect(() => {
    const user = getTelegramUser();
    initialize(user);
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized || needsProfileSetup || welcomeShown) {
      return;
    }

    const fromStartCommand = launchedFromStartCommand();
    pushToast({
      type: 'success',
      title: 'Добро пожаловать!',
      description: fromStartCommand
        ? 'Приложение запущено через команду /start. Удачной работы!'
        : 'Рады видеть вас в Boost!'
    });

    setWelcomeShown(true);
  }, [isInitialized, needsProfileSetup, welcomeShown, pushToast]);

  useEffect(() => {
    if (!isInitialized || needsProfileSetup || !user) {
      return;
    }

    if (!hasLoadedOrders) {
      void loadOrders().catch(error => {
        console.error('[app] Failed to load orders', error);
      });
    }

    void loadTaskCompletions(user.id);
  }, [isInitialized, needsProfileSetup, user, hasLoadedOrders, loadOrders, loadTaskCompletions]);

  useEffect(() => {
    if (!isInitialized || needsProfileSetup || !user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadOrders(true).catch(error => {
        console.error('[app] Failed to refresh orders', error);
      });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isInitialized, needsProfileSetup, user, loadOrders]);

  if (!isInitialized) {
    return <Loader label="Загружаем данные профиля" />;
  }

  if (needsProfileSetup) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar isMobileOpen={isSidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {isSidebarOpen && <button type="button" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className="app-shell-content">
        <Header onMenuToggle={() => setSidebarOpen(prev => !prev)} />
        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </main>
        <Footer />
      </div>
      <ToastContainer />
    </div>
  );
};

export default App;
