import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useAppSettingsStore } from './store/AppSettingStore.ts';
import Login from './pages/Login'; // Вход
import Register from './pages/Register'; // Регистрация
import Dashboard from './pages/Dashboard'; // Панель управления
import Tasks from './pages/Tasks'; // Задачи
import Profile from './pages/Profile'; // Профиль
import Settings from './pages/Settings'; // Настройки
import Messages from './pages/Messages'; // Сообщения
import Teams from './pages/Teams'; // Команды
import Statistics from './pages/Statistics'; // Статистика
import AdminPanel from './pages/AdminPanel'; // Админ-панель
import PremiumCalculation from './pages/PremiumCalculation'; // Расчет премий
import Layout from './components/Layout'; // Макет

// Приватный маршрут с проверкой аутентификации и ролей
function PrivateRoute({ children, requiredRoles = [] }: { children: React.ReactNode, requiredRoles?: string[] }) {
  const { user, loading } = useAuthStore();

  // Если данные пользователя загружаются
  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div> {/* Индикатор загрузки */}
        </div>
    );
  }

  // Если пользователь не аутентифицирован, перенаправляем на страницу входа
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Если требуются определенные роли и текущая роль пользователя не соответствует, перенаправляем на главную
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function App() {
  const { loadUser } = useAuthStore(); // Загрузка данных пользователя
  const { loadSettings } = useAppSettingsStore(); // Загрузка настроек приложения

  // Загружаем данные пользователя и настройки при монтировании компонента
  useEffect(() => {
    loadUser();
    loadSettings();
  }, [loadUser, loadSettings]);

  return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} /> {/* Маршрут для входа */}
          <Route path="/register" element={<Register />} /> {/* Маршрут для регистрации */}
          <Route path="/" element={
            <PrivateRoute>
              <Layout>
                <Dashboard /> {/* Главная панель управления */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/tasks" element={
            <PrivateRoute>
              <Layout>
                <Tasks /> {/* Страница задач */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute>
              <Layout>
                <Profile /> {/* Страница профиля */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute>
              <Layout>
                <Settings /> {/* Страница настроек */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/messages" element={
            <PrivateRoute>
              <Layout>
                <Messages /> {/* Страница сообщений */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/teams" element={
            <PrivateRoute>
              <Layout>
                <Teams /> {/* Страница команд */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/statistics" element={
            <PrivateRoute requiredRoles={['Администратор', 'Менеджер']}>
              <Layout>
                <Statistics /> {/* Страница статистики (доступна только администраторам и менеджерам) */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute requiredRoles={['Администратор']}>
              <Layout>
                <AdminPanel /> {/* Админ-панель (доступна только администраторам) */}
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/premium" element={
            <PrivateRoute requiredRoles={['Администратор', 'Менеджер']}>
              <Layout>
                <PremiumCalculation /> {/* Расчет премий (доступен администраторам и менеджерам) */}
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
  );
}

export default App;