import React, { useState, useEffect } from 'react';
import { X, Search, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import type { TaskPriority, Profile } from '../../types/database';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export function CreateTaskModal({ isOpen, onClose, onTaskCreated }: CreateTaskModalProps) {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('Средний');
    setDueDate('');
    setSelectedAssignee(null);
    setSearchQuery('');
    setError('');
    setFiles([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File, taskId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${taskId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

      await supabase.from('attachments').insert({
        task_id: taskId,
        user_id: user!.id,
        file_name: file.name,
        file_type: file.type,
        file_url: urlData.publicUrl,
        file_size: file.size
      });

    } catch (err) {
      console.error('Ошибка загрузки файла:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setError('');
    setLoading(true);

    try {
      const { data: taskData, error: createError } = await supabase
          .from('tasks')
          .insert([
            {
              title,
              description: description || null,
              priority,
              status: 'В_ожидании',
              created_by: user.id,
              assigned_to: selectedAssignee?.id || null,
              due_date: dueDate ? new Date(dueDate).toISOString() : null,
            },
          ])
          .select();

      if (createError) throw createError;

      if (!taskData || taskData.length === 0) {
        throw new Error('Не удалось создать задачу - данные не возвращены');
      }

      const taskId = taskData[0].id;

      if (files.length > 0) {
        await Promise.all(files.map(file => uploadFile(file, taskId)));
      }

      onTaskCreated();
      handleClose();
    } catch (err: any) {
      console.error('Ошибка создания задачи:', err);
      setError(err.message || 'Не удалось создать задачу');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Создать новую задачу</h2>
            <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Заголовок
              </label>
              <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                  required
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
              />
            </div>

            <div>
              <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Исполнитель
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
                    >
                      Очистить
                    </button>
                  </div>
              )}
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
              >
                <option value="Низкий">Низкий</option>
                <option value="Средний">Средний</option>
                <option value="Высокий">Высокий</option>
              </select>
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Вложения
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
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
                      />
                    </label>
                    <p className="pl-1">или перетащите сюда</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG, PDF, DOCX до 10МБ
                  </p>
                </div>
              </div>
              {files.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Выбранные файлы:</h4>
                    <ul className="space-y-2">
                      {files.map((file, index) => (
                          <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <span className="truncate max-w-xs">{file.name}</span>
                            <button
                                type="button"
                                onClick={() => removeFile(index)}
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
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Отмена
              </button>
              <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:focus:ring-offset-gray-900"
              >
                {loading ? 'Создание...' : 'Создать задачу'}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}