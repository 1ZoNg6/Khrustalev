import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppSettingsStore } from '../store/AppSettingStore.ts';
import { UserPlus, Mail, Lock, User } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuthStore();
  const { appName } = useAppSettingsStore();

  // Валидация формы
  const validateForm = () => {
    if (!email || !password || !fullName) {
      setError('Все поля обязательны для заполнения');
      return false;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return false;
    }
    if (!email.includes('@')) {
      setError('Пожалуйста, введите действительный адрес электронной почты');
      return false;
    }
    return true;
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      await signUp(email, password, fullName);
      navigate('/login');
    } catch (err: any) {
      if (err?.message?.includes('User already registered')) {
        setError('Этот email уже зарегистрирован. Пожалуйста, войдите в систему.');
      } else if (err?.message?.includes('Password should be')) {
        setError('Пароль должен содержать не менее 6 символов');
      } else {
        setError(err.message || 'Ошибка при создании аккаунта. Пожалуйста, попробуйте снова.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
              Создайте аккаунт в {appName}
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
                <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
              <div className="relative">
                <label htmlFor="full-name" className="sr-only">
                  Полное имя
                </label>
                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                    id="full-name"
                    name="fullName"
                    type="text"
                    required
                    className="appearance-none rounded-t-md relative block w-full px-10 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-700/50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Полное имя"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                />
              </div>
              <div className="relative">
                <label htmlFor="email" className="sr-only">
                  Адрес электронной почты
                </label>
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none relative block w-full px-10 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-700/50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Адрес электронной почты"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                />
              </div>
              <div className="relative">
                <label htmlFor="password" className="sr-only">
                  Пароль
                </label>
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none rounded-b-md relative block w-full px-10 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-700/50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Пароль (мин. 6 символов)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    disabled={loading}
                />
              </div>
            </div>

            <div>
              <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
              </button>
            </div>

            <div className="text-sm text-center">
              <Link
                  to="/login"
                  className="font-medium text-blue-400 hover:text-blue-300"
              >
                Уже есть аккаунт? Войти
              </Link>
            </div>
          </form>
        </div>
      </div>
  );
}