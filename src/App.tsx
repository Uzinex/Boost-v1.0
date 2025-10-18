import { useEffect } from 'react';
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
import { getTelegramUser } from './utils/telegram';

const App = () => {
  const initialize = useUserStore(state => state.initialize);
  const isInitialized = useUserStore(state => state.isInitialized);

  useEffect(() => {
    const user = getTelegramUser();
    initialize(user);
  }, [initialize]);

  if (!isInitialized) {
    return <Loader label="Загружаем данные профиля" />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
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
