import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { User, Camera, X, CheckSquare, Clock, AlertTriangle } from 'lucide-react';

export default function Profile() {
    const { user, updateProfile } = useAuthStore();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            setAvatarUrl(user.avatar_url || '');
            fetchUserStats();
            fetchRecentActivity();
        }
    }, [user]);

    // Получение статистики пользователя
    const fetchUserStats = async () => {
        if (!user) return;

        try {
            // Получение статистики задач пользователя
            const { data: statsData, error: statsError } = await supabase
                .from('tasks')
                .select('status', { count: 'exact' })
                .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);

            if (statsError) throw statsError;

            const total = statsData?.length || 0;
            const completed = statsData?.filter(t => t.status === 'completed').length || 0;
            const inProgress = statsData?.filter(t => t.status === 'in_progress').length || 0;
            const pending = statsData?.filter(t => t.status === 'pending').length || 0;

            setStats({ total, completed, inProgress, pending });
        } catch (err) {
            console.error('Ошибка при получении статистики пользователя:', err);
        }
    };

    // Получение последних действий пользователя
    const fetchRecentActivity = async () => {
        if (!user) return;

        try {
            // Получение истории последних действий
            const { data: historyData, error: historyError } = await supabase
                .from('task_history')
                .select(`
                    *,
                    task:tasks(*),
                    user_profile:profiles(*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (historyError) throw historyError;

            setRecentActivity(historyData || []);
        } catch (err) {
            console.error('Ошибка при получении последних действий:', err);
        }
    };

    // Обработчик клика по аватару
    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    // Обработчик изменения файла аватара
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        const fileSize = file.size / 1024 / 1024; // размер в МБ

        if (fileSize > 2) {
            setError('Размер файла должен быть менее 2 МБ');
            return;
        }

        setUploadingAvatar(true);
        setError('');

        try {
            // Загрузка изображения в хранилище
            const fileExt = file.name.split('.').pop();
            const fileName = `${user?.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Получение публичного URL
            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl = urlData.publicUrl;

            // Обновление профиля
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: avatarUrl })
                .eq('id', user?.id);

            if (updateError) throw updateError;

            setAvatarUrl(avatarUrl);
            await updateProfile({ avatar_url: avatarUrl });
            setSuccess('Фотография профиля успешно обновлена');
        } catch (err) {
            console.error('Ошибка при загрузке аватара:', err);
            setError('Не удалось загрузить фотографию профиля');
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Удаление аватара
    const removeAvatar = async () => {
        if (!avatarUrl) return;

        setUploadingAvatar(true);
        setError('');

        try {
            // Обновление профиля для удаления URL аватара
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user?.id);

            if (updateError) throw updateError;

            setAvatarUrl('');
            await updateProfile({ avatar_url: null });
            setSuccess('Фотография профиля успешно удалена');
        } catch (err) {
            console.error('Ошибка при удалении аватара:', err);
            setError('Не удалось удалить фотографию профиля');
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Форматирование даты
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Форматирование описания активности
    const formatActivityDescription = (activity: any) => {
        switch (activity.field_changed) {
            case 'status':
                return `Изменил статус задачи с "${activity.old_value === 'completed' ? 'выполнено' : activity.old_value === 'in_progress' ? 'в процессе' : 'ожидает'}" на "${activity.new_value === 'completed' ? 'выполнено' : activity.new_value === 'in_progress' ? 'в процессе' : 'ожидает'}"`;
            case 'priority':
                return `Изменил приоритет задачи с "${activity.old_value === 'high' ? 'высокий' : activity.old_value === 'medium' ? 'средний' : 'низкий'}" на "${activity.new_value === 'high' ? 'высокий' : activity.new_value === 'medium' ? 'средний' : 'низкий'}"`;
            case 'assigned_to':
                return `Изменил назначение задачи с ${activity.old_value || 'Не назначено'} на ${activity.new_value || 'Не назначено'}`;
            default:
                return `Изменил ${activity.field_changed === 'title' ? 'название' : activity.field_changed === 'description' ? 'описание' : activity.field_changed} с "${activity.old_value}" на "${activity.new_value}"`;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
                            <User className="mr-2 h-6 w-6" />
                            Ваш профиль
                        </h1>
                    </div>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200 px-4 py-3 rounded">
                            {success}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <div
                                    className="h-32 w-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden cursor-pointer"
                                    onClick={handleAvatarClick}
                                >
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={user?.full_name || 'Профиль'}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <User className="h-16 w-16 text-gray-400" />
                                    )}

                                    {uploadingAvatar && (
                                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAvatarClick}
                                    className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
                                >
                                    <Camera className="h-4 w-4" />
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>

                            {avatarUrl && (
                                <button
                                    type="button"
                                    onClick={removeAvatar}
                                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm flex items-center"
                                    disabled={uploadingAvatar}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Удалить фото
                                </button>
                            )}

                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                Нажмите, чтобы загрузить фото профиля<br />
                                (Макс. размер: 2 МБ)
                            </p>
                        </div>

                        <div className="flex-1">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Полное имя</h3>
                                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{user?.full_name}</p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Роль</h3>
                                        <p className="mt-1 text-lg font-semibold capitalize text-gray-900 dark:text-white">
                                            {user?.role === 'Администратор' ? 'Администратор' : user?.role === 'Менеджер' ? 'Менеджер' : 'Работник'}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Дата регистрации</h3>
                                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                                            {user?.created_at ? formatDate(user.created_at) : 'Н/Д'}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Статус аккаунта</h3>
                                        <p className="mt-1">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                                Активен
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Ваша статистика</h2>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Всего задач</p>
                                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
                                </div>
                                <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-full">
                                    <CheckSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-600 dark:text-green-400 text-sm font-medium">Выполнено</p>
                                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.completed}</p>
                                </div>
                                <div className="bg-green-100 dark:bg-green-800 p-3 rounded-full">
                                    <CheckSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">В процессе</p>
                                    <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{stats.inProgress}</p>
                                </div>
                                <div className="bg-yellow-100 dark:bg-yellow-800 p-3 rounded-full">
                                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">Ожидает</p>
                                    <p className="text-3xl font-bold text-red-700 dark:text-red-300">{stats.pending}</p>
                                </div>
                                <div className="bg-red-100 dark:bg-red-800 p-3 rounded-full">
                                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Последние действия</h2>
                </div>
                <div className="p-6">
                    {recentActivity.length > 0 ? (
                        <div className="space-y-4">
                            {recentActivity.map(activity => (
                                <div key={activity.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                    <div className="flex justify-between">
                                        <p className="text-gray-900 dark:text-white font-medium">
                                            {formatActivityDescription(activity)}
                                        </p>
                                    </div>
                                    <div className="mt-2 flex justify-between">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Задача: {activity.task?.title || 'Неизвестная задача'}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(activity.created_at).toLocaleString('ru-RU', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">Нет последних действий</p>
                    )}
                </div>
            </div>
        </div>
    );
}