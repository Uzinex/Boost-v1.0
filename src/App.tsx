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
import { getTelegramUser } from './utils/telegram';
import { ManualRegistration } from './components/auth/ManualRegistration';

const App = () => {
  const initialize = useUserStore(state => state.initialize);
  const isInitialized = useUserStore(state => state.isInitialized);
  const needsProfileSetup = useUserStore(state => state.needsProfileSetup);

  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const user = getTelegramUser();
    initialize(user);
  }, [initialize]);

  if (!isInitialized) {
    return <Loader label="Загружаем данные профиля" />;
  }

  if (needsProfileSetup) {
    return (
      <>
        <ManualRegistration />
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
