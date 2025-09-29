import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppSettingsStore } from '../store/AppSettingStore.ts';
import {
    LayoutDashboard,
    CheckSquare,
    LogOut,
    MessageSquare,
    Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ThemeToggle from './ui/ThemeToggle';
import ProfileDropdown from './ui/ProfileDropdown';
import NotificationsDropdown from './ui/NotificationsDropdown';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const { user, signOut } = useAuthStore();
    const { appName } = useAppSettingsStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);

    useEffect(() => {
        if (!user?.id) return;

        const fetchNotificationCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('read', false);

                if (error) throw error;
                setUnreadNotifications(count || 0);
            } catch (err) {
                console.error('Error fetching notification count:', err);
            }
        };

        const fetchMessageCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('receiver_id', user.id)
                    .eq('read', false);

                if (error) throw error;
                setUnreadMessages(count || 0);
            } catch (err) {
                console.error('Error fetching message count:', err);
            }
        };

        fetchNotificationCount();
        fetchMessageCount();

        // Set up subscription for new notifications
        const notificationsSubscription = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchNotificationCount();
                }
            )
            .subscribe();

        // Set up subscription for new messages
        const messagesSubscription = supabase
            .channel('messages-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`
                },
                () => {
                    fetchMessageCount();
                }
            )
            .subscribe();

        return () => {
            notificationsSubscription.unsubscribe();
            messagesSubscription.unsubscribe();
        };
    }, [user?.id]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const isActive = (path: string) => {
        return location.pathname === path;
    };


    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
            <nav className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white">
                                    {appName}
                                </Link>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    to="/"
                                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                                        isActive('/')
                                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                            : 'text-gray-900 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                                    }`}
                                >
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    Главная
                                </Link>
                                <Link
                                    to="/tasks"
                                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                                        isActive('/tasks')
                                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                            : 'text-gray-900 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                                    }`}
                                >
                                    <CheckSquare className="mr-2 h-4 w-4" />
                                    Задачи
                                </Link>
                                <Link
                                    to="/messages"
                                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                                        isActive('/messages')
                                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                            : 'text-gray-900 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                                    }`}
                                >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Сообщения
                                    {unreadMessages > 0 && (
                                        <span className="ml-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                                    )}
                                </Link>
                                <Link
                                    to="/teams"
                                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                                        isActive('/teams')
                                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                            : 'text-gray-900 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                                    }`}
                                >
                                    <Users className="mr-2 h-4 w-4" />
                                    Команды
                                </Link>
                                {(user?.role === 'Администратор' || user?.role === 'Менеджер') && (
                                    <Link
                                        to="/statistics"
                                        className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                                            isActive('/statistics')
                                                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                                : 'text-gray-900 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                                        }`}
                                    >
                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                        Статистика
                                    </Link>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <ThemeToggle />

                            <NotificationsDropdown
                                unreadCount={unreadNotifications}
                            />

                            <ProfileDropdown />

                            <button
                                onClick={handleSignOut}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                <div className="sm:hidden">
                    <div className="pt-2 pb-3 space-y-1">
                        <Link
                            to="/"
                            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                isActive('/')
                                    ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300'
                                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Главная
                        </Link>
                        <Link
                            to="/tasks"
                            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                isActive('/tasks')
                                    ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300'
                                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Задачи
                        </Link>
                        <Link
                            to="/messages"
                            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                isActive('/messages')
                                    ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300'
                                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Сообщения
                            {unreadMessages > 0 && (
                                <span className="ml-2 inline-block bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
                            )}
                        </Link>
                        <Link
                            to="/teams"
                            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                isActive('/teams')
                                    ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300'
                                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            Команды
                        </Link>
                        {(user?.role === 'Администратор' || user?.role === 'Менеджер') && (
                            <Link
                                to="/statistics"
                                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                    isActive('/statistics')
                                        ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                Статистика
                            </Link>
                        )}
                        {(user?.role === 'Администратор' || user?.role === 'Менеджер') && (
                            <Link
                                to="/premium"
                                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                    isActive('/premium')
                                        ? 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                Расчет премий
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}