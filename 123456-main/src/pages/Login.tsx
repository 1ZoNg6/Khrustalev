import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppSettingsStore } from '../store/AppSettingStore.ts';
import { LogIn, Mail, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const { appName } = useAppSettingsStore();

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
              Вход в {appName}
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
                <label htmlFor="email" className="sr-only">
                  Адрес электронной почты
                </label>
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="appearance-none rounded-t-md relative block w-full px-10 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-700/50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
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
                    required
                    className="appearance-none rounded-b-md relative block w-full px-10 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-700/50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <LogIn className="h-5 w-5 mr-2" />
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>

            <div className="text-sm text-center">
              <Link
                  to="/register"
                  className="font-medium text-blue-400 hover:text-blue-300"
              >
                Нет аккаунта? Зарегистрируйтесь
              </Link>
            </div>
          </form>
        </div>
      </div>
  );
}