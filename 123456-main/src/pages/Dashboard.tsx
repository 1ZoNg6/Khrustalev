import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  MessageSquare,
  ArrowRight,
  BarChart
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TaskCard } from '../components/TaskCard';
import { TaskDetailsModal } from '../components/task/TaskDetailsModal';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale'; // Импортируем локализацию для русского языка
import type { Task } from '../types/database';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [dueSoonTasks, setDueSoonTasks] = useState<Task[]>([]);
  const [highPriorityTasks, setHighPriorityTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    teamCount: 0,
    messageCount: 0
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  // Настройка подписок на изменения в реальном времени
  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    const tasksSubscription = supabase
        .channel('tasks-changes')
        .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'tasks',
            },
            () => {
              fetchDashboardData();
            }
        )
        .subscribe();

    const teamsSubscription = supabase
        .channel('teams-changes')
        .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'teams',
            },
            () => {
              fetchTeamCount();
            }
        )
        .subscribe();

    const messagesSubscription = supabase
        .channel('messages-changes')
        .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
            },
            () => {
              fetchMessageCount();
            }
        )
        .subscribe();

    return () => {
      tasksSubscription.unsubscribe();
      teamsSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
    };
  };

  // Загрузка данных для панели управления
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTaskStats(),
        fetchRecentTasks(),
        fetchDueSoonTasks(),
        fetchHighPriorityTasks(),
        fetchTeamCount(),
        fetchMessageCount()
      ]);
    } catch (error) {
      console.error('Ошибка при загрузке данных панели управления:', error);
    } finally {
      setLoading(false);
    }
  };

  // Получение статистики задач
  const fetchTaskStats = async () => {
    try {
      const { data: statsData, error: statsError } = await supabase
          .from('tasks')
          .select('status', { count: 'exact' });

      if (statsError) throw statsError;

      const total = statsData?.length || 0;
      const completed = statsData?.filter(t => t.status === 'completed').length || 0;
      const inProgress = statsData?.filter(t => t.status === 'in_progress').length || 0;
      const pending = statsData?.filter(t => t.status === 'pending').length || 0;

      setStats(prev => ({
        ...prev,
        total,
        completed,
        inProgress,
        pending
      }));
    } catch (err) {
      console.error('Ошибка при получении статистики задач:', err);
    }
  };

  // Получение количества команд
  const fetchTeamCount = async () => {
    try {
      const { count, error } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true });

      if (error) throw error;

      setStats(prev => ({
        ...prev,
        teamCount: count || 0
      }));
    } catch (err) {
      console.error('Ошибка при получении количества команд:', err);
    }
  };

  // Получение количества непрочитанных сообщений
  const fetchMessageCount = async () => {
    try {
      const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user?.id)
          .eq('read', false);

      if (error) throw error;

      setStats(prev => ({
        ...prev,
        messageCount: count || 0
      }));
    } catch (err) {
      console.error('Ошибка при получении количества сообщений:', err);
    }
  };

  // Получение последних задач
  const fetchRecentTasks = async () => {
    try {
      let query = supabase
          .from('tasks')
          .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(*),
          created_by_profile:profiles!tasks_created_by_fkey(*)
        `)
          .order('created_at', { ascending: false })
          .limit(5);

      if (user?.role !== 'Администратор' && user?.role !== 'Менеджер') {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecentTasks(data || []);
    } catch (err) {
      console.error('Ошибка при получении последних задач:', err);
    }
  };

  // Получение задач с приближающимся сроком
  const fetchDueSoonTasks = async () => {
    try {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      let query = supabase
          .from('tasks')
          .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(*),
          created_by_profile:profiles!tasks_created_by_fkey(*)
        `)
          .lt('due_date', nextWeek.toISOString())
          .gt('due_date', new Date().toISOString())
          .not('status', 'eq', 'Завершено')
          .order('due_date', { ascending: true })
          .limit(5);

      if (user?.role !== 'Администратор' && user?.role !== 'Менеджер') {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDueSoonTasks(data || []);
    } catch (err) {
      console.error('Ошибка при получении задач с приближающимся сроком:', err);
    }
  };

  // Получение задач с высоким приоритетом
  const fetchHighPriorityTasks = async () => {
    try {
      let query = supabase
          .from('tasks')
          .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(*),
          created_by_profile:profiles!tasks_created_by_fkey(*)
        `)
          .eq('priority', 'Высокий')
          .not('status', 'eq', 'Завершено')
          .order('created_at', { ascending: false })
          .limit(5);

      if (user?.role !== 'Администратор' && user?.role !== 'Менеджер') {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHighPriorityTasks(data || []);
    } catch (err) {
      console.error('Ошибка при получении задач с высоким приоритетом:', err);
    }
  };

  // Обработчик клика по задаче
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailsModalOpen(true);
  };

  // Обработчик обновления задачи
  const handleTaskUpdated = () => {
    fetchDashboardData();
  };

  // Обработчик удаления задачи
  const handleTaskDeleted = () => {
    fetchDashboardData();
  };

  if (loading) {
    return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* Приветственная секция */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-900 dark:to-blue-950 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            С возвращением, {user?.full_name}!
          </h1>
          <p className="text-blue-100 text-lg">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ru })}
          </p>
        </div>

        {/* Быстрая статистика */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Задачи</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</h3>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
                <CheckSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                {stats.completed} выполнено
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                {stats.inProgress} в процессе
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Команды</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.teamCount}</h3>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-full">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <Link
                to="/teams"
                className="mt-4 inline-flex items-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            >
              Посмотреть все команды
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Сообщения</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.messageCount}</h3>
              </div>
              <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <Link
                to="/messages"
                className="mt-4 inline-flex items-center text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              Посмотреть сообщения
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {(user?.role === 'Администратор' || user?.role === 'Менеджер') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Аналитика</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Посмотреть статистику</h3>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-full">
                    <BarChart className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <Link
                    to="/statistics"
                    className="mt-4 inline-flex items-center text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                >
                  Посмотреть статистику
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
          )}
        </div>

        {/* Секции задач */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Последние задачи */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Последние задачи
              </h2>
              <Link
                  to="/tasks"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
              >
                Посмотреть все
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {recentTasks.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 text-center">
                  <CheckSquare className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Последние задачи не найдены</p>
                </div>
            ) : (
                <div className="space-y-4">
                  {recentTasks.map(task => (
                      <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => handleTaskClick(task)}
                      />
                  ))}
                </div>
            )}
          </div>

          {/* Задачи с приближающимся сроком */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Скоро истекает срок
              </h2>
              <Link
                  to="/tasks"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
              >
                Посмотреть все
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {dueSoonTasks.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Нет задач с приближающимся сроком</p>
                </div>
            ) : (
                <div className="space-y-4">
                  {dueSoonTasks.map(task => (
                      <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => handleTaskClick(task)}
                      />
                  ))}
                </div>
            )}
          </div>
        </div>

        {/* Задачи с высоким приоритетом */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Задачи с высоким приоритетом
            </h2>
            <Link
                to="/tasks"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
            >
              Посмотреть все
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {highPriorityTasks.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Нет задач с высоким приоритетом</p>
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {highPriorityTasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => handleTaskClick(task)}
                    />
                ))}
              </div>
          )}
        </div>

        {selectedTask && (
            <TaskDetailsModal
                task={selectedTask}
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
            />
        )}
      </div>
  );
}