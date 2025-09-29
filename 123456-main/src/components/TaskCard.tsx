import { Task } from '../types/database';
import { Bell, Paperclip, MessageSquare } from 'lucide-react';

interface TaskWithNotifications extends Task {
  unread_notifications?: number;
  attachment_count?: number;
  comment_count?: number;
}

interface TaskCardProps {
  task: TaskWithNotifications;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
      <div
          onClick={onClick}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 cursor-pointer relative"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {task.title}
              </h3>
              {task.unread_notifications && task.unread_notifications > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                <Bell className="w-3 h-3 mr-1" />
                    {task.unread_notifications}
              </span>
              )}
            </div>
            {task.description && (
                <p className="text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                  {task.description}
                </p>
            )}
            {task.assigned_to_profile && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Назначено: {task.assigned_to_profile.full_name}
                </p>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
          <span
              className={`px-2 py-1 rounded text-sm ${
                  task.priority === 'Высокий'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      : task.priority === 'Средний'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
              }`}
          >
            {task.priority}
          </span>
            <span
                className={`px-2 py-1 rounded text-sm ${
                    task.status === 'Завершено'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                        : task.status === 'В_процессе'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                }`}
            >
            {task.status.replace('_', ' ')}
          </span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {task.due_date && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Дата звершения: {new Date(task.due_date).toLocaleDateString()}
              </div>
          )}
          <div className="flex space-x-2">
            {task.comment_count && task.comment_count > 0 && (
                <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-3 h-3 mr-1" />
                  {task.comment_count}
            </span>
            )}
            {task.attachment_count && task.attachment_count > 0 && (
                <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Paperclip className="w-3 h-3 mr-1" />
                  {task.attachment_count}
            </span>
            )}
          </div>
        </div>
      </div>
  );
}