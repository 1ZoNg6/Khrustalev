import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  X,
  Edit,
  Trash2,
  Calendar,
  Clock,
  User,
  Tag,
  AlertCircle,
  Paperclip,
  Download,
  Search
} from 'lucide-react';
import TaskChat from './TaskChat';
import type { Task, Profile, TaskStatus, TaskPriority, Attachment } from '../../types/database';

interface TaskDetailsModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  onTaskDeleted: () => void;
}

export function TaskDetailsModal({
                                   task,
                                   isOpen,
                                   onClose,
                                   onTaskUpdated,
                                   onTaskDeleted
                                 }: TaskDetailsModalProps) {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<Profile | null>(
      task.assigned_to_profile || null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const canEditPriority = user?.role === 'Администратор' || user?.role === 'Менеджер';
  const canEditTask = user?.role === 'Администратор' || user?.role === 'Менеджер' || task.assigned_to === user?.id;
  const canDeleteTask = user?.role === 'Администратор' || user?.role === 'Менеджер' || task.created_by === user?.id;

  useEffect(() => {
    if (isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '');
      setSelectedAssignee(task.assigned_to_profile || null);
      fetchAttachments();
      fetchTaskHistory();
    }
  }, [isOpen, task]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .ilike('full_name', `%${searchQuery}%`)
            .limit(5);

        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error('Ошибка поиска пользователей:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
          .from('attachments')
          .select('*')
          .eq('task_id', task.id)
          .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (err) {
      console.error('Ошибка загрузки вложений:', err);
    }
  };

  const fetchTaskHistory = async () => {
    try {
      const { data, error } = await supabase
          .from('task_history')
          .select(`
          *,
          user_profile:profiles(*)
        `)
          .eq('task_id', task.id)
          .order('created_at', { ascending: false });

      if (error) throw error;
      setTaskHistory(data || []);
    } catch (err) {
      console.error('Ошибка загрузки истории задачи:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setNewFiles(prevFiles => [...prevFiles, ...files]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (newFiles.length === 0) return;

    setUploadingFiles(true);
    try {
      await Promise.all(
          newFiles.map(async (file) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
            const filePath = `${task.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('attachments')
                .getPublicUrl(filePath);

            await supabase.from('attachments').insert({
              task_id: task.id,
              user_id: user!.id,
              file_name: file.name,
              file_type: file.type,
              file_url: urlData.publicUrl,
              file_size: file.size
            });
          })
      );

      setNewFiles([]);
      fetchAttachments();
      setSuccess('Файлы успешно загружены');
    } catch (err) {
      console.error('Ошибка загрузки файлов:', err);
      setError('Не удалось загрузить файлы');
    } finally {
      setUploadingFiles(false);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
          .from('attachments')
          .delete()
          .eq('id', attachmentId);

      if (error) throw error;

      setAttachments(prevAttachments =>
          prevAttachments.filter(attachment => attachment.id !== attachmentId)
      );

      setSuccess('Вложение успешно удалено');
    } catch (err) {
      console.error('Ошибка удаления вложения:', err);
      setError('Не удалось удалить вложение');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Подготовка данных для обновления в зависимости от роли пользователя
      const updateData: any = {};

      // Статус может быть обновлен любым назначенным на задачу
      if (status !== task.status) {
        updateData.status = status;
      }

      // Только менеджеры и администраторы могут обновлять эти поля
      if (user.role === 'Администратор' || user.role === 'Менеджер') {
        if (title !== task.title) updateData.title = title;
        if (description !== task.description) updateData.description = description || null;
        if (priority !== task.priority) updateData.priority = priority;
        if (selectedAssignee?.id !== task.assigned_to) {
          updateData.assigned_to = selectedAssignee?.id || null;
        }
        if (dueDate !== (task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '')) {
          updateData.due_date = dueDate ? new Date(dueDate).toISOString() : null;
        }
      } else {
        // Работники могут обновлять только статус
        if (Object.keys(updateData).length === 0) {
          setError('У вас нет прав для обновления этой задачи');
          setLoading(false);
          return;
        }
      }

      // Если нет изменений, не обновляем
      if (Object.keys(updateData).length === 0) {
        setError('Нет изменений для сохранения');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', task.id);

      if (updateError) throw updateError;

      // Загрузка новых файлов
      if (newFiles.length > 0) {
        await uploadFiles();
      }

      setSuccess('Задача успешно обновлена');
      setIsEditing(false);
      onTaskUpdated();
    } catch (err) {
      console.error('Ошибка обновления задачи:', err);
      setError('Не удалось обновить задачу');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteTask) {
      setError('У вас нет прав для удаления этой задачи');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id);

      if (error) throw error;

      onTaskDeleted();
      onClose();
    } catch (err) {
      console.error('Ошибка удаления задачи:', err);
      setError('Не удалось удалить задачу');
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'Высокий':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'Средний':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    }
  };

  const getFieldChangeDescription = (fieldChanged: string, oldValue: string | null, newValue: string | null) => {
    switch (fieldChanged) {
      case 'status':
        return `Статус изменен с "${oldValue}" на "${newValue}"`;
      case 'priority':
        return `Приоритет изменен с "${oldValue}" на "${newValue}"`;
      case 'assigned_to':
        return `Назначение изменено с ${oldValue || 'Не назначено'} на ${newValue || 'Не назначено'}`;
      default:
        return `${fieldChanged} изменен с "${oldValue}" на "${newValue}"`;
    }
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div
            ref={modalRef}
            className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Редактирование задачи' : 'Детали задачи'}
            </h2>
            <div className="flex items-center space-x-2">
              {canEditTask && !isEditing && (
                  <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
              )}
              {canDeleteTask && !isEditing && (
                  <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
              )}
              <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
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

            {showDeleteConfirm ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                  <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Подтверждение удаления</h3>
                  <p className="text-red-700 dark:text-red-200 mb-4">
                    Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Отмена
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? 'Удаление...' : 'Удалить задачу'}
                    </button>
                  </div>
                </div>
            ) : isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Название
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                        required
                        disabled={!canEditTask || user?.role === 'Работник'}
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Описание
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                        disabled={!canEditTask || user?.role === 'Работник'}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Статус
                      </label>
                      <select
                          id="status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value as TaskStatus)}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                          disabled={!canEditTask}
                      >
                        <option value="В_ожидании">В ожидании</option>
                        <option value="В_процессе">В процессе</option>
                        <option value="Завершено">Завершено</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Приоритет
                      </label>
                      <select
                          id="priority"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as TaskPriority)}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                          disabled={!canEditPriority}
                      >
                        <option value="Низкий">Низкий</option>
                        <option value="Средний">Средний</option>
                        <option value="Высокий">Высокий</option>
                      </select>
                      {!canEditPriority && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Только менеджеры и администраторы могут изменять приоритет
                          </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Назначено на
                    </label>
                    <div className="relative mt-1">
                      <div className="relative">
                        <input
                            type="text"
                            id="assignee"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по имени..."
                            className="block w-full rounded-md border-gray-300 dark:border-gray-700 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                            disabled={!canEditTask || user?.role === 'Работник'}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      {isSearching && (
                          <div className="absolute right-0 top-0 h-full flex items-center pr-3">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                          </div>
                      )}
                      {users.length > 0 && searchQuery && (
                          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssignee(user);
                                      setSearchQuery(user.full_name);
                                      setUsers([]);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {user.full_name} ({user.role})
                                </button>
                            ))}
                          </div>
                      )}
                    </div>
                    {selectedAssignee && (
                        <div className="mt-2 flex items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Выбрано: {selectedAssignee.full_name}
                    </span>
                          <button
                              type="button"
                              onClick={() => {
                                setSelectedAssignee(null);
                                setSearchQuery('');
                              }}
                              className="ml-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              disabled={!canEditTask || user?.role === 'Работник'}
                          >
                            Очистить
                          </button>
                        </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Срок выполнения
                    </label>
                    <input
                        type="datetime-local"
                        id="dueDate"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                        disabled={!canEditTask || user?.role === 'Работник'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Вложения
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 dark:text-gray-400">
                          <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none"
                          >
                            <span>Загрузить файлы</span>
                            <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                multiple
                                onChange={handleFileChange}
                                ref={fileInputRef}
                            />
                          </label>
                          <p className="pl-1">или перетащите их сюда</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PNG, JPG, PDF, DOCX до 10MB
                        </p>
                      </div>
                    </div>
                    {newFiles.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Файлы для загрузки:</h4>
                          <ul className="space-y-2">
                            {newFiles.map((file, index) => (
                                <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                  <span className="truncate max-w-xs">{file.name}</span>
                                  <button
                                      type="button"
                                      onClick={() => removeNewFile(index)}
                                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </li>
                            ))}
                          </ul>
                        </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:focus:ring-offset-gray-900"
                    >
                      {loading ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </form>
            ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{task.title}</h3>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {task.description || 'Описание отсутствует.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Tag className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Статус</h4>
                      </div>
                      <span className={`px-2 py-1 rounded text-sm ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <AlertCircle className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Приоритет</h4>
                      </div>
                      <span className={`px-2 py-1 rounded text-sm ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Назначено на</h4>
                      </div>
                      <p className="text-gray-900 dark:text-white">
                        {task.assigned_to_profile ? task.assigned_to_profile.full_name : 'Не назначено'}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Срок выполнения</h4>
                      </div>
                      <p className="text-gray-900 dark:text-white">
                        {task.due_date ? new Date(task.due_date).toLocaleString() : 'Срок не установлен'}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Создано</h4>
                      </div>
                      <p className="text-gray-900 dark:text-white">
                        {task.created_by_profile ? task.created_by_profile.full_name : 'Неизвестно'}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Создано</h4>
                      </div>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(task.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Раздел вложений */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">Вложения</h4>
                      <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Добавить файлы
                      </button>
                    </div>

                    {newFiles.length > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Новые файлы</h5>
                            <button
                                onClick={uploadFiles}
                                disabled={uploadingFiles}
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {uploadingFiles ? 'Загрузка...' : 'Загрузить все'}
                            </button>
                          </div>
                          <ul className="space-y-2">
                            {newFiles.map((file, index) => (
                                <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                  <span className="truncate max-w-xs">{file.name}</span>
                                  <button
                                      onClick={() => removeNewFile(index)}
                                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </li>
                            ))}
                          </ul>
                        </div>
                    )}

                    {attachments.length > 0 ? (
                        <ul className="space-y-2">
                          {attachments.map((attachment) => (
                              <li
                                  key={attachment.id}
                                  className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded"
                              >
                                <div className="flex items-center">
                                  <Paperclip className="h-4 w-4 mr-2" />
                                  <span className="truncate max-w-xs">{attachment.file_name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <a
                                      href={attachment.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                      download
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                  {(user?.id === attachment.user_id || user?.role === 'Администратор' || user?.role === 'Менеджер') && (
                                      <button
                                          onClick={() => deleteAttachment(attachment.id)}
                                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                  )}
                                </div>
                              </li>
                          ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Вложений пока нет</p>
                    )}
                  </div>

                  {/* Раздел истории задачи */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">История задачи</h4>
                      <button
                          onClick={() => setShowHistory(!showHistory)}
                          className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {showHistory ? 'Скрыть историю' : 'Показать историю'}
                      </button>
                    </div>

                    {showHistory && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                          {taskHistory.length > 0 ? (
                              <ul className="space-y-3">
                                {taskHistory.map((history) => (
                                    <li key={history.id} className="text-sm border-b border-gray-200 dark:border-gray-600 pb-2">
                                      <div className="flex justify-between">
                              <span className="text-gray-900 dark:text-white">
                                {getFieldChangeDescription(history.field_changed, history.old_value, history.new_value)}
                              </span>
                                      </div>
                                      <div className="flex justify-between mt-1">
                              <span className="text-gray-500 dark:text-gray-400">
                                Автор: {history.user_profile?.full_name || 'Неизвестно'}
                              </span>
                                        <span className="text-gray-500 dark:text-gray-400">
                                {formatDate(history.created_at)}
                              </span>
                                      </div>
                                    </li>
                                ))}
                              </ul>
                          ) : (
                              <p className="text-gray-500 dark:text-gray-400">История отсутствует</p>
                          )}
                        </div>
                    )}
                  </div>

                  {/* Раздел чата задачи */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <TaskChat
                        taskId={task.id}
                        assigneeId={task.assigned_to}
                        creatorId={task.created_by}
                    />
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}