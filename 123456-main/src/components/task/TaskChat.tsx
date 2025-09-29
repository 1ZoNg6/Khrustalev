import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Send, User } from 'lucide-react';
import type { Profile } from '../../types/database';

interface TaskChatMessage {
    id: string;
    task_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_profile?: Profile;
}

interface TaskChatProps {
    taskId: string;
    assigneeId: string | null;
    creatorId: string;
}

export default function TaskChat({ taskId, assigneeId, creatorId }: TaskChatProps) {
    const { user } = useAuthStore();
    const [messages, setMessages] = useState<TaskChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        fetchMessages();
        fetchParticipants();

        const subscription = supabase
            .channel(`task-chat-${taskId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'task_chat_messages',
                    filter: `task_id=eq.${taskId}`,
                },
                (payload) => {
                    fetchMessageWithSender(payload.new.id);
                },
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [taskId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchParticipants = async () => {
        try {
            const participantIds = [creatorId];
            if (assigneeId) participantIds.push(assigneeId);

            const uniqueIds = [...new Set(participantIds.filter(Boolean))];

            if (uniqueIds.length > 0) {
                const { error } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', uniqueIds);

                if (error) throw error;
            }
        } catch (err) {
            console.error('Ошибка получения участников:', err);
        }
    };

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('task_chat_messages')
                .select(`
          *,
          sender_profile:profiles(*)
        `)
                .eq('task_id', taskId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Ошибка получения сообщений чата задачи:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessageWithSender = async (messageId: string) => {
        try {
            const { data, error } = await supabase
                .from('task_chat_messages')
                .select(`
          *,
          sender_profile:profiles(*)
        `)
                .eq('id', messageId)
                .single();

            if (error) throw error;
            if (data) {
                setMessages((prev) => [...prev, data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            }
        } catch (err) {
            console.error('Ошибка получения нового сообщения:', err);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        try {
            const { error } = await supabase
                .from('task_chat_messages')
                .insert({
                    task_id: taskId,
                    sender_id: user.id,
                    content: newMessage.trim(),
                });

            if (error) throw error;

            setNewMessage('');
            messageInputRef.current?.focus();
        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Сегодня';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Вчера';
        } else {
            return date.toLocaleDateString('ru-RU');
        }
    };

    const groupedMessages: { [date: string]: TaskChatMessage[] } = {};
    messages.forEach((message) => {
        const date = formatDate(message.created_at);
        if (!groupedMessages[date]) {
            groupedMessages[date] = [];
        }
        groupedMessages[date].push(message);
    });

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Чат задачи</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Общение с участниками задачи
                </p>
            </div>

            <div className="flex-1 overflow-y-auto max-h-60 mb-4 space-y-4">
                {loading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                        Сообщений пока нет. Начните общение!
                    </div>
                ) : (
                    Object.entries(groupedMessages).map(([date, dateMessages]) => (
                        <div key={date} className="space-y-3">
                            <div className="flex justify-center">
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">
                  {date}
                </span>
                            </div>
                            {dateMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    {message.sender_id !== user?.id && (
                                        <div className="flex-shrink-0 mr-2">
                                            {message.sender_profile?.avatar_url ? (
                                                <img
                                                    src={message.sender_profile.avatar_url}
                                                    alt={message.sender_profile.full_name}
                                                    className="h-8 w-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                            message.sender_id === user?.id
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                        }`}
                                    >
                                        {message.sender_id !== user?.id && (
                                            <div className="font-medium text-xs mb-1">
                                                {message.sender_profile?.full_name || 'Неизвестный пользователь'}
                                            </div>
                                        )}
                                        <p>{message.content}</p>
                                        <p className={`text-xs mt-1 ${
                                            message.sender_id === user?.id
                                                ? 'text-blue-100'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                            {formatTime(message.created_at)}
                                        </p>
                                    </div>
                                    {message.sender_id === user?.id && (
                                        <div className="flex-shrink-0 ml-2">
                                            {user?.avatar_url ? (
                                                <img
                                                    src={user.avatar_url}
                                                    alt={user.full_name}
                                                    className="h-8 w-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="mt-auto">
                <div className="flex items-end space-x-2">
          <textarea
              ref={messageInputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Напишите сообщение..."
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              rows={2}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                  }
              }}
          />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </div>
            </form>
        </div>
    );
}