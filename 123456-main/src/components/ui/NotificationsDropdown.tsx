import { useState, useRef, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

interface NotificationsDropdownProps {
    unreadCount: number;
}

export default function NotificationsDropdown({ unreadCount }: NotificationsDropdownProps) {
    const { user } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
          *,
          task:tasks(*),
          message:messages(*)
        `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId);

            if (error) throw error;

            // Update local state
            setNotifications(prev =>
                prev.map(notification =>
                    notification.id === notificationId
                        ? { ...notification, read: true }
                        : notification
                )
            );
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (error) throw error;

            // Update local state
            setNotifications(prev =>
                prev.map(notification => ({ ...notification, read: true }))
            );
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;

            // Update local state
            setNotifications(prev =>
                prev.filter(notification => notification.id !== notificationId)
            );
        } catch (err) {
            console.error('Error deleting notification:', err);
        }
    };

    const getNotificationLink = (notification: any) => {
        if (notification.task_id) {
            return `/tasks?taskId=${notification.task_id}`;
        } else if (notification.message_id) {
            return `/messages`;
        }
        return '#';
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMins / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 relative p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-10 ring-1 ring-black ring-opacity-5">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Уведомления</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                Пометить все прочитанным
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center items-center p-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            </div>
                        ) : notifications.length > 0 ? (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                            !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                        }`}
                                    >
                                        <div className="flex justify-between">
                                            <Link
                                                to={getNotificationLink(notification)}
                                                className="flex-1"
                                                onClick={() => {
                                                    if (!notification.read) {
                                                        markAsRead(notification.id);
                                                    }
                                                    setIsOpen(false);
                                                }}
                                            >
                                                <p className="text-sm text-gray-800 dark:text-gray-200">
                                                    {notification.content}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {formatTime(notification.created_at)}
                                                </p>
                                            </Link>
                                            <button
                                                onClick={() => deleteNotification(notification.id)}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                Уведомлений нет
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}