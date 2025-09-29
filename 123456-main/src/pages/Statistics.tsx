import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
    BarChart,
    PieChart,
    Clock,
    User,
    CheckSquare,
    AlertTriangle,
    Filter,
    Download
} from 'lucide-react';

export default function Statistics() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dateRange, setDateRange] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [users, setUsers] = useState<any[]>([]);

    // Состояния для статистики
    const [taskStats, setTaskStats] = useState({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0
    });

    const [priorityStats, setPriorityStats] = useState({
        high: 0,
        medium: 0,
        low: 0
    });

    const [userStats, setUserStats] = useState<any[]>([]);
    const [timeStats, setTimeStats] = useState<any[]>([]);
    const [completionRate, setCompletionRate] = useState(0);
    const [avgCompletionTime, setAvgCompletionTime] = useState(0);

    useEffect(() => {
        if (user?.role === 'Администратор' || user?.role === 'Менеджер') {
            fetchUsers();
            fetchStatistics();
        }
    }, [user, dateRange, userFilter]);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .order('full_name');

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Ошибка при загрузке пользователей:', err);
        }
    };

    const fetchStatistics = async () => {
        setLoading(true);
        setError('');

        try {
            // Сборка запроса с фильтрами
            let query = supabase.from('tasks').select('*');

            // Применение фильтра по дате
            if (dateRange !== 'all') {
                const today = new Date();
                let startDate;

                switch (dateRange) {
                    case 'today':
                        startDate = new Date(today.setHours(0, 0, 0, 0));
                        break;
                    case 'week':
                        startDate = new Date(today);
                        startDate.setDate(today.getDate() - 7);
                        break;
                    case 'month':
                        startDate = new Date(today);
                        startDate.setMonth(today.getMonth() - 1);
                        break;
                    case 'quarter':
                        startDate = new Date(today);
                        startDate.setMonth(today.getMonth() - 3);
                        break;
                    default:
                        startDate = null;
                }

                if (startDate) {
                    query = query.gte('created_at', startDate.toISOString());
                }
            }

            // Применение фильтра по пользователю
            if (userFilter !== 'all') {
                query = query.eq('assigned_to', userFilter);
            }

            // Выполнение запроса
            const { data, error } = await query;

            if (error) throw error;

            // Обработка статистики задач
            const total = data?.length || 0;
            const completed = data?.filter(t => t.status === 'Завершено').length || 0;
            const inProgress = data?.filter(t => t.status === 'В_процессе').length || 0;
            const pending = data?.filter(t => t.status === 'В_ожидании').length || 0;

            setTaskStats({
                total,
                completed,
                inProgress,
                pending
            });

            // Обработка статистики приоритетов
            const high = data?.filter(t => t.priority === 'Высокий').length || 0;
            const medium = data?.filter(t => t.priority === 'Средний').length || 0;
            const low = data?.filter(t => t.priority === 'Низкий').length || 0;

            setPriorityStats({
                high,
                medium,
                low
            });

            // Расчет процента выполнения
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
            setCompletionRate(completionRate);

            // Расчет среднего времени выполнения для завершенных задач
            const completedTasks = data?.filter(t => t.status === 'completed') || [];
            let totalCompletionTime = 0;

            completedTasks.forEach(task => {
                if (task.created_at && task.updated_at) {
                    const createdDate = new Date(task.created_at);
                    const completedDate = new Date(task.updated_at);
                    const timeDiff = completedDate.getTime() - createdDate.getTime();
                    totalCompletionTime += timeDiff;
                }
            });

            const avgTime = completedTasks.length > 0
                ? Math.round(totalCompletionTime / completedTasks.length / (1000 * 60 * 60 * 24)) // в днях
                : 0;

            setAvgCompletionTime(avgTime);

            // Обработка статистики по пользователям
            const userStatsMap = new Map();

            data?.forEach(task => {
                if (task.assigned_to) {
                    const userId = task.assigned_to;
                    if (!userStatsMap.has(userId)) {
                        userStatsMap.set(userId, {
                            userId,
                            total: 0,
                            Завершено: 0,
                            В_ожидании: 0,
                            В_процессе: 0
                        });
                    }

                    const userStat = userStatsMap.get(userId);
                    userStat.total += 1;

                    if (task.status === 'Завершено') {
                        userStat.Завершено += 1;
                    } else if (task.status === 'В_процессе') {
                        userStat.В_процессе += 1;
                    } else {
                        userStat.В_ожидании += 1;
                    }
                }
            });

            // Преобразование Map в массив и добавление имен пользователей
            const userStatsArray = Array.from(userStatsMap.values());

            // Загрузка имен пользователей
            const userIds = userStatsArray.map(stat => stat.userId);

            if (userIds.length > 0) {
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);

                if (userError) throw userError;

                // Добавление имен пользователей в статистику
                userStatsArray.forEach(stat => {
                    const userInfo = userData?.find(u => u.id === stat.userId);
                    stat.userName = userInfo?.full_name || 'Неизвестно';
                });
            }

            setUserStats(userStatsArray);

            // Обработка временной статистики (задачи по месяцам)
            const timeStatsMap = new Map();

            data?.forEach(task => {
                if (task.created_at) {
                    const date = new Date(task.created_at);
                    const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;

                    if (!timeStatsMap.has(monthYear)) {
                        timeStatsMap.set(monthYear, {
                            month: monthYear,
                            count: 0,
                            label: new Date(date.getFullYear(), date.getMonth(), 1).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
                        });
                    }

                    timeStatsMap.get(monthYear).count += 1;
                }
            });

            // Преобразование Map в массив и сортировка по дате
            const timeStatsArray = Array.from(timeStatsMap.values())
                .sort((a, b) => a.month.localeCompare(b.month));

            setTimeStats(timeStatsArray);

        } catch (err) {
            console.error('Ошибка при загрузке статистики:', err);
            setError('Не удалось загрузить статистику');
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        // Создание CSV-контента
        let csvContent = "data:text/csv;charset=utf-8,";

        // Добавление заголовков
        csvContent += "Категория,Метрика,Значение\n";

        // Добавление статистики задач
        csvContent += `Задачи,Всего,${taskStats.total}\n`;
        csvContent += `Задачи,Завершено,${taskStats.completed}\n`;
        csvContent += `Задачи,В процессе,${taskStats.inProgress}\n`;
        csvContent += `Задачи,Ожидание,${taskStats.pending}\n`;

        // Добавление статистики приоритетов
        csvContent += `Приоритет,Высокий,${priorityStats.high}\n`;
        csvContent += `Приоритет,Средний,${priorityStats.medium}\n`;
        csvContent += `Приоритет,Низкий,${priorityStats.low}\n`;

        // Добавление других метрик
        csvContent += `Производительность,Процент выполнения,${completionRate}%\n`;
        csvContent += `Производительность,Среднее время выполнения,${avgCompletionTime} дней\n`;

        // Добавление статистики по пользователям
        userStats.forEach(stat => {
            csvContent += `Пользователь,${stat.userName} Всего,${stat.total}\n`;
            csvContent += `Пользователь,${stat.userName} Завершено,${stat.Завершено}\n`;
        });

        // Добавление временной статистики
        timeStats.forEach(stat => {
            csvContent += `Время,${stat.label},${stat.count}\n`;
        });

        // Создание ссылки для скачивания
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `статистика_задач_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);

        // Запуск скачивания
        link.click();

        // Очистка
        document.body.removeChild(link);
    };

    if (user?.role !== 'Администратор' && user?.role !== 'Менеджер') {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-center py-12">
                    <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Доступ запрещен</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        У вас нет прав для просмотра этой страницы.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Панель статистики</h1>

                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center">
                            <Filter className="h-5 w-5 text-gray-400 mr-2" />
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm dark:text-white"
                            >
                                <option value="all">За все время</option>
                                <option value="today">Сегодня</option>
                                <option value="week">Последние 7 дней</option>
                                <option value="month">Последние 30 дней</option>
                                <option value="quarter">Последние 90 дней</option>
                            </select>
                        </div>

                        <div className="flex items-center">
                            <User className="h-5 w-5 text-gray-400 mr-2" />
                            <select
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                                className="block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm dark:text-white"
                            >
                                <option value="all">Все пользователи</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={exportToCSV}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Экспорт в CSV
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Карточки с общей информацией */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Всего задач</p>
                                        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{taskStats.total}</p>
                                    </div>
                                    <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-full">
                                        <CheckSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-green-600 dark:text-green-400 text-sm font-medium">Процент выполнения</p>
                                        <p className="text-3xl font-bold text-green-700 dark:text-green-300">{completionRate}%</p>
                                    </div>
                                    <div className="bg-green-100 dark:bg-green-800 p-3 rounded-full">
                                        <PieChart className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Среднее время выполнения</p>
                                        <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{avgCompletionTime} дней</p>
                                    </div>
                                    <div className="bg-yellow-100 dark:bg-yellow-800 p-3 rounded-full">
                                        <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Высокий приоритет</p>
                                        <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{priorityStats.high}</p>
                                    </div>
                                    <div className="bg-purple-100 dark:bg-purple-800 p-3 rounded-full">
                                        <AlertTriangle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* График распределения задач по статусам */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Распределение задач по статусам</h2>
                            <div className="flex flex-col md:flex-row items-center">
                                <div className="w-full md:w-1/2">
                                    <div className="flex justify-center">
                                        <BarChart className="h-48 w-48 text-gray-400" />
                                    </div>
                                </div>
                                <div className="w-full md:w-1/2 mt-4 md:mt-0">
                                    <div className="space-y-4">
                                        <div className="flex items-center">
                                            <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Завершено</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{taskStats.completed}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                                                    <div
                                                        className="bg-green-500 h-2.5 rounded-full"
                                                        style={{ width: `${taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">В процессе</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{taskStats.inProgress}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                                                    <div
                                                        className="bg-blue-500 h-2.5 rounded-full"
                                                        style={{ width: `${taskStats.total > 0 ? (taskStats.inProgress / taskStats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-4 h-4 bg-gray-500 rounded-full mr-2"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ожидание</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{taskStats.pending}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                                                    <div
                                                        className="bg-gray-500 h-2.5 rounded-full"
                                                        style={{ width: `${taskStats.total > 0 ? (taskStats.pending / taskStats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Распределение задач по приоритетам */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Распределение задач по приоритетам</h2>
                            <div className="flex flex-col md:flex-row items-center">
                                <div className="w-full md:w-1/2">
                                    <div className="flex justify-center">
                                        <PieChart className="h-48 w-48 text-gray-400" />
                                    </div>
                                </div>
                                <div className="w-full md:w-1/2 mt-4 md:mt-0">
                                    <div className="space-y-4">
                                        <div className="flex items-center">
                                            <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Высокий приоритет</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{priorityStats.high}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                                                    <div
                                                        className="bg-red-500 h-2.5 rounded-full"
                                                        style={{ width: `${taskStats.total > 0 ? (priorityStats.high / taskStats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Средний приоритет</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{priorityStats.medium}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                                                    <div
                                                        className="bg-yellow-500 h-2.5 rounded-full"
                                                        style={{ width: `${taskStats.total > 0 ? (priorityStats.medium / taskStats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Низкий приоритет</span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{priorityStats.low}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                                                    <div
                                                        className="bg-green-500 h-2.5 rounded-full"
                                                        style={{ width: `${taskStats.total > 0 ? (priorityStats.low / taskStats.total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Производительность пользователей */}
                        {userStats.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Производительность пользователей</h2>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Пользователь
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Всего задач
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Завершено
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                В процессе
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Ожидание
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Процент выполнения
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {userStats.map((stat, index) => (
                                            <tr key={stat.userId} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {stat.userName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {stat.total}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {stat.Завершено}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {stat.В_процессе}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {stat.В_ожидании}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                                    {stat.total > 0 ? Math.round((stat.Завершено / stat.total) * 100) : 0}%
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Временная статистика */}
                        {timeStats.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Статистика создания задач</h2>
                                <div className="h-64 flex items-end justify-between space-x-2">
                                    {timeStats.map(stat => (
                                        <div key={stat.month} className="flex flex-col items-center flex-1">
                                            <div
                                                className="bg-blue-500 w-full rounded-t-md"
                                                style={{
                                                    height: `${Math.max(
                                                        5,
                                                        timeStats.length > 0
                                                            ? (stat.count / Math.max(...timeStats.map(s => s.count))) * 200
                                                            : 0
                                                    )}px`
                                                }}
                                            ></div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-top-left">
                                                {stat.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}