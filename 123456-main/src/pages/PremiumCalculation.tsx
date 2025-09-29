import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface EmployeeMetrics {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  task_completion_frequency: number;
  tasks_not_completed_on_time: number;
  tasks_completed_on_time: number;
  total_contract_value: number;
  number_of_delays: number;
  normalized_score: number;
  premium_amount: number;
  profile?: {
    full_name: string;
    role: string;
  };
}

interface PremiumFund {
  id: string;
  period_start: string;
  period_end: string;
  total_fund_amount: number;
  status: 'active' | 'calculated' | 'distributed';
  created_at: string;
}

export default function PremiumCalculation() {
  const { user } = useAuthStore();
  const [funds, setFunds] = useState<PremiumFund[]>([]);
  const [metrics, setMetrics] = useState<EmployeeMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCalculateModalOpen, setIsCalculateModalOpen] = useState(false);
  const [selectedFund, setSelectedFund] = useState<PremiumFund | null>(null);

  // Form states
  const [newFund, setNewFund] = useState({
    period_start: '',
    period_end: '',
    total_fund_amount: 0
  });

  const [newMetrics, setNewMetrics] = useState({
    user_id: '',
    task_completion_frequency: 0,
    tasks_not_completed_on_time: 0,
    tasks_completed_on_time: 0,
    total_contract_value: 0,
    number_of_delays: 0
  });

  const [users, setUsers] = useState<any[]>([]);

  // Check if user has permission
  const canManagePremiums = user?.role === 'Администратор' || user?.role === 'Менеджер';

  useEffect(() => {
    if (canManagePremiums) {
      fetchData();
    }
  }, [canManagePremiums]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch premium funds
      const { data: fundsData, error: fundsError } = await supabase
        .from('premium_funds')
        .select('*')
        .order('created_at', { ascending: false });

      if (fundsError) throw fundsError;

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name');

      if (usersError) throw usersError;

      setFunds(fundsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (fundId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_metrics')
        .select(`
          *,
          profile:profiles(full_name, role)
        `)
        .eq('period_start', selectedFund?.period_start)
        .eq('period_end', selectedFund?.period_end);

      if (error) throw error;
      setMetrics(data || []);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Ошибка загрузки метрик');
    }
  };

  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('premium_funds')
        .insert([{
          period_start: newFund.period_start,
          period_end: newFund.period_end,
          total_fund_amount: newFund.total_fund_amount,
          created_by: user?.id
        }]);

      if (error) throw error;

      setNewFund({ period_start: '', period_end: '', total_fund_amount: 0 });
      setIsCreateModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error creating fund:', err);
      setError('Ошибка создания премиального фонда');
    }
  };

  const handleAddMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return;

    try {
      const { error } = await supabase
        .from('employee_metrics')
        .insert([{
          user_id: newMetrics.user_id,
          period_start: selectedFund.period_start,
          period_end: selectedFund.period_end,
          task_completion_frequency: newMetrics.task_completion_frequency,
          tasks_not_completed_on_time: newMetrics.tasks_not_completed_on_time,
          tasks_completed_on_time: newMetrics.tasks_completed_on_time,
          total_contract_value: newMetrics.total_contract_value,
          number_of_delays: newMetrics.number_of_delays
        }]);

      if (error) throw error;

      setNewMetrics({
        user_id: '',
        task_completion_frequency: 0,
        tasks_not_completed_on_time: 0,
        tasks_completed_on_time: 0,
        total_contract_value: 0,
        number_of_delays: 0
      });
      fetchMetrics(selectedFund.id);
    } catch (err) {
      console.error('Error adding metrics:', err);
      setError('Ошибка добавления метрик');
    }
  };

  const handleCalculatePremiums = async () => {
    if (!selectedFund) return;

    try {
      const { error } = await supabase.rpc('calculate_premium_distribution', {
        p_fund_id: selectedFund.id
      });

      if (error) throw error;

      fetchData();
      fetchMetrics(selectedFund.id);
    } catch (err) {
      console.error('Error calculating premiums:', err);
      setError('Ошибка расчета премий');
    }
  };

  if (!canManagePremiums) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
          <p className="text-gray-600">У вас нет прав для управления премиальным фондом</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Расчет премиального фонда</h1>
          <p className="text-gray-600">Управление премиальным фондом и расчет премий сотрудников</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Premium Funds List */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Премиальные фонды</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Создать фонд
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Период
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма фонда
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {funds.map((fund) => (
                  <tr key={fund.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(fund.period_start).toLocaleDateString()} - {new Date(fund.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fund.total_fund_amount.toLocaleString()} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        fund.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                        fund.status === 'calculated' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {fund.status === 'active' ? 'Активен' :
                         fund.status === 'calculated' ? 'Рассчитан' : 'Распределен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedFund(fund);
                          setIsCalculateModalOpen(true);
                          fetchMetrics(fund.id);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Управление
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Fund Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Создать премиальный фонд</h3>
                <form onSubmit={handleCreateFund}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Начало периода
                    </label>
                    <input
                      type="date"
                      value={newFund.period_start}
                      onChange={(e) => setNewFund({ ...newFund, period_start: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Конец периода
                    </label>
                    <input
                      type="date"
                      value={newFund.period_end}
                      onChange={(e) => setNewFund({ ...newFund, period_end: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Сумма фонда (₽)
                    </label>
                    <input
                      type="number"
                      value={newFund.total_fund_amount}
                      onChange={(e) => setNewFund({ ...newFund, total_fund_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      min="0"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Calculate Premiums Modal */}
        {isCalculateModalOpen && selectedFund && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Управление фондом: {new Date(selectedFund.period_start).toLocaleDateString()} - {new Date(selectedFund.period_end).toLocaleDateString()}
                  </h3>
                  <button
                    onClick={() => setIsCalculateModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* Add Metrics Form */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Добавить метрики сотрудника</h4>
                  <form onSubmit={handleAddMetrics} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Сотрудник</label>
                      <select
                        value={newMetrics.user_id}
                        onChange={(e) => setNewMetrics({ ...newMetrics, user_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Выберите сотрудника</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Частота выполнения задач</label>
                      <input
                        type="number"
                        value={newMetrics.task_completion_frequency}
                        onChange={(e) => setNewMetrics({ ...newMetrics, task_completion_frequency: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Невыполненные в срок</label>
                      <input
                        type="number"
                        value={newMetrics.tasks_not_completed_on_time}
                        onChange={(e) => setNewMetrics({ ...newMetrics, tasks_not_completed_on_time: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Выполненные в срок</label>
                      <input
                        type="number"
                        value={newMetrics.tasks_completed_on_time}
                        onChange={(e) => setNewMetrics({ ...newMetrics, tasks_completed_on_time: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Стоимость контрактов (₽)</label>
                      <input
                        type="number"
                        value={newMetrics.total_contract_value}
                        onChange={(e) => setNewMetrics({ ...newMetrics, total_contract_value: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Количество опозданий</label>
                      <input
                        type="number"
                        value={newMetrics.number_of_delays}
                        onChange={(e) => setNewMetrics({ ...newMetrics, number_of_delays: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <button
                        type="submit"
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                      >
                        Добавить метрики
                      </button>
                    </div>
                  </form>
                </div>

                {/* Calculate Button */}
                <div className="mb-4">
                  <button
                    onClick={handleCalculatePremiums}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                  >
                    Рассчитать премии
                  </button>
                </div>

                {/* Metrics Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Сотрудник
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Частота задач
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Невыполненные
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Выполненные
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Стоимость контрактов
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Опоздания
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Балл
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Премия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metrics.map((metric) => (
                        <tr key={metric.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.profile?.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.task_completion_frequency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.tasks_not_completed_on_time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.tasks_completed_on_time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.total_contract_value.toLocaleString()} ₽
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.number_of_delays}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {metric.normalized_score.toFixed(4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            {metric.premium_amount.toLocaleString()} ₽
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

