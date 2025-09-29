import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Search, Send, User, Edit, Trash2, Check, X } from 'lucide-react';
import type { Profile, Message } from '../types/database';

interface ExtendedMessage extends Message {
    sender_profile?: Profile | null;
    receiver_profile?: Profile | null;
}

interface ContactWithUnread extends Profile {
    unreadCount: number;
}

export default function Messages() {
    const { user } = useAuthStore();
    const [contacts, setContacts] = useState<ContactWithUnread[]>([]);
    const [selectedContact, setSelectedContact] = useState<ContactWithUnread | null>(null);
    const [messages, setMessages] = useState<ExtendedMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editedContent, setEditedContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    // Получение списка контактов с количеством непрочитанных сообщений
    const fetchContacts = async () => {
        if (!user) return;

        try {
            // Получение отправленных сообщений
            const { data: sentMessages, error: sentError } = await supabase
                .from('messages')
                .select('receiver_id, receiver_profile:profiles!messages_receiver_id_fkey(*)')
                .eq('sender_id', user.id)
                .order('created_at', { ascending: false });

            // Получение полученных сообщений с количеством непрочитанных
            const { data: receivedMessages, error: receivedError } = await supabase
                .from('messages')
                .select('sender_id, sender_profile:profiles!messages_sender_id_fkey(*), read')
                .eq('receiver_id', user.id)
                .order('created_at', { ascending: false });

            if (sentError) throw new Error(`Ошибка получения отправленных сообщений: ${sentError.message}`);
            if (receivedError) throw new Error(`Ошибка получения полученных сообщений: ${receivedError.message}`);

            const contactMap = new Map<string, ContactWithUnread>();

            // Обработка отправленных сообщений
            sentMessages?.forEach((msg) => {
                if (msg.receiver_profile && !contactMap.has(msg.receiver_id)) {
                    contactMap.set(msg.receiver_id, { ...msg.receiver_profile, unreadCount: 0 });
                }
            });

            // Обработка полученных сообщений и подсчёт непрочитанных
            receivedMessages?.forEach((msg) => {
                if (msg.sender_profile) {
                    if (!contactMap.has(msg.sender_id)) {
                        contactMap.set(msg.sender_id, { ...msg.sender_profile, unreadCount: 0 });
                    }
                    if (!msg.read) {
                        const contact = contactMap.get(msg.sender_id);
                        if (contact) {
                            contact.unreadCount += 1;
                        }
                    }
                }
            });

            setContacts(Array.from(contactMap.values()));
        } catch (error) {
            console.error('Ошибка при получении контактов:', error instanceof Error ? error.message : error);
        }
    };

    // Получение сообщений между текущим пользователем и выбранным контактом
    const fetchMessages = async () => {
        if (!user || !selectedContact) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
          *,
          sender_profile:profiles!messages_sender_id_fkey(*),
          receiver_profile:profiles!messages_receiver_id_fkey(*)
        `)
                .or(
                    `and(sender_id.eq.${user.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${user.id})`,
                )
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Ошибка получения сообщений:', error.message);
                throw new Error(`Ошибка получения сообщений: ${error.message}`);
            }
            setMessages(data || []);

            // Пометка полученных сообщений как прочитанных
            const { error: updateError } = await supabase
                .from('messages')
                .update({ read: true })
                .eq('receiver_id', user.id)
                .eq('sender_id', selectedContact.id)
                .eq('read', false);

            if (updateError) throw new Error(`Ошибка пометки как прочитанных: ${updateError.message}`);

            // Обновление количества непрочитанных сообщений для выбранного контакта
            setContacts((prevContacts) =>
                prevContacts.map((contact) =>
                    contact.id === selectedContact.id ? { ...contact, unreadCount: 0 } : contact
                )
            );
        } catch (error) {
            console.error('Ошибка при получении сообщений:', error instanceof Error ? error.message : error);
        } finally {
            setLoading(false);
        }
    };

    // Поиск пользователей
    useEffect(() => {
        const searchUsers = async () => {
            if (!searchQuery.trim() || !user) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .ilike('full_name', `%${searchQuery}%`)
                    .neq('id', user.id)
                    .limit(5);

                if (error) throw new Error(`Ошибка поиска пользователей: ${error.message}`);
                setSearchResults(data || []);
            } catch (error) {
                console.error('Ошибка при поиске пользователей:', error instanceof Error ? error.message : error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery, user?.id]);

    // Начальная загрузка
    useEffect(() => {
        fetchContacts();
    }, [user]);

    // Загрузка сообщений при выборе контакта
    useEffect(() => {
        if (selectedContact) {
            fetchMessages();
            setSearchQuery('');
        }
    }, [selectedContact]);

    // Прокрутка к последнему сообщению при изменении списка сообщений
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Настройка подписки на новые сообщения в реальном времени
    useEffect(() => {
        if (!user) return;

        const subscription = supabase
            .channel('messages-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `or(sender_id.eq.${user.id},receiver_id.eq.${user.id})`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT' && payload.new.receiver_id === user.id && !payload.new.read) {
                        // Получено новое непрочитанное сообщение
                        setContacts((prevContacts) => {
                            const updatedContacts = prevContacts.map((contact) =>
                                contact.id === payload.new.sender_id
                                    ? { ...contact, unreadCount: contact.unreadCount + 1 }
                                    : contact
                            );
                            return updatedContacts;
                        });
                    }
                    if (selectedContact) {
                        fetchMessages();
                    } else {
                        fetchContacts();
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user?.id, selectedContact?.id]);

    // Отправка сообщения
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user || !selectedContact || !newMessage.trim()) return;

        const tempMessage: ExtendedMessage = {
            id: 'temp-' + Date.now(),
            sender_id: user.id,
            receiver_id: selectedContact.id,
            content: newMessage.trim(),
            read: false,
            created_at: new Date().toISOString(),
            sender_profile: user,
            receiver_profile: selectedContact,
        };
        setMessages((prevMessages) => [...prevMessages, tempMessage]);
        setNewMessage('');
        messageInputRef.current?.focus();

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: selectedContact.id,
                    content: newMessage.trim(),
                })
                .select();

            if (error) throw new Error(`Ошибка отправки сообщения: ${error.message}`);

            if (data && data.length > 0) {
                const realMessage = { ...data[0], sender_profile: user, receiver_profile: selectedContact };
                setMessages((prevMessages) =>
                    prevMessages.map((msg) => (msg.id.startsWith('temp-') ? realMessage : msg))
                );
            }
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error instanceof Error ? error.message : error);
            setMessages((prevMessages) => prevMessages.filter((msg) => !msg.id.startsWith('temp-')));
        }
    };

    // Редактирование сообщения
    const handleEditMessage = async (message: ExtendedMessage) => {
        if (!message.id || !user) return;

        try {
            const { error } = await supabase
                .from('messages')
                .update({ content: editedContent.trim() })
                .eq('id', message.id)
                .eq('sender_id', user.id);

            if (error) throw new Error(`Ошибка редактирования сообщения: ${error.message}`);

            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg.id === message.id ? { ...msg, content: editedContent.trim() } : msg
                )
            );
            setEditingMessageId(null);
            setEditedContent('');
        } catch (error) {
            console.error('Ошибка при редактировании сообщения:', error instanceof Error ? error.message : error);
        }
    };

    // Удаление сообщения
    const handleDeleteMessage = async (messageId: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .eq('sender_id', user.id);

            if (error) throw new Error(`Ошибка удаления сообщения: ${error.message}`);

            setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== messageId));
        } catch (error) {
            console.error('Ошибка при удалении сообщения:', error instanceof Error ? error.message : error);
        }
    };

    // Удаление всей переписки
    const handleDeleteConversation = async () => {
        if (!user || !selectedContact) return;

        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .or(
                    `and(sender_id.eq.${user.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${user.id})`,
                );

            if (error) throw new Error(`Ошибка удаления переписки: ${error.message}`);

            setMessages([]);
            setSelectedContact(null);
            fetchContacts();
        } catch (error) {
            console.error('Ошибка при удалении переписки:', error instanceof Error ? error.message : error);
        }
    };

    const selectContact = (contact: ContactWithUnread) => {
        setSelectedContact(contact);
        setSearchResults([]);
    };

    // Форматирование времени
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    // Форматирование даты
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
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        }
    };

    const groupedMessages = React.useMemo(() => {
        const groups: { [date: string]: ExtendedMessage[] } = {};
        messages.forEach((message) => {
            const date = formatDate(message.created_at.toString());
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(message);
        });
        return groups;
    }, [messages]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-[calc(100vh-12rem)] flex">
            {/* Боковая панель с контактами (фиксированная слева) */}
            <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Сообщения</h2>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск пользователей..."
                            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        {isSearching && (
                            <div className="absolute right-3 top-2.5">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="overflow-y-auto flex-1">
                    {searchQuery && searchResults.length > 0 ? (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {searchResults.map((result) => (
                                <div
                                    key={result.id}
                                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                    onClick={() => selectContact({ ...result, unreadCount: 0 })}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-10 w-10 flex items-center justify-center mr-3">
                                                <User className="h-6 w-6 text-gray-500 dark:text-gray-300" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{result.full_name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                                    {result.role === 'Администратор' ? 'Администратор' : result.role === 'Менеджер' ? 'Менеджер' : 'Работник'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : searchQuery && searchResults.length === 0 && !isSearching ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Пользователи не найдены</div>
                    ) : contacts.length > 0 ? (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {contacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                                        selectedContact?.id === contact.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                                    }`}
                                    onClick={() => selectContact(contact)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-10 w-10 flex items-center justify-center mr-3">
                                                <User className="h-6 w-6 text-gray-500 dark:text-gray-300" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{contact.full_name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                                    {contact.role === 'Администратор' ? 'Администратор' : contact.role === 'Менеджер' ? 'Менеджер' : 'Работник'}
                                                </p>
                                            </div>
                                        </div>
                                        {contact.unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-xs font-semibold rounded-full px-2 py-1">
                                                {contact.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Переписки отсутствуют</div>
                    )}
                </div>
            </div>

            {/* Область сообщений (Правая часть с фиксированным заголовком и прокручиваемыми сообщениями) */}
            <div className="w-2/3 flex flex-col">
                {selectedContact ? (
                    <>
                        {/* Заголовок контакта (фиксированный сверху) */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <div className="flex items-center">
                                <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-10 w-10 flex items-center justify-center mr-3">
                                    <User className="h-6 w-6 text-gray-500 dark:text-gray-300" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900 dark:text-white">{selectedContact.full_name}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                        {selectedContact.role === 'Администратор' ? 'Администратор' : selectedContact.role === 'Менеджер' ? 'Менеджер' : 'Работник'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleDeleteConversation}
                                className="text-red-500 hover:text-red-700"
                                title="Удалить переписку"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Прокручиваемые сообщения */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loading && messages.length === 0 ? (
                                <div className="flex justify-center items-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-500 dark:text-gray-400 h-full flex items-center justify-center">
                                    Сообщений еще нет. Начните переписку!
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
                                                className={`flex ${
                                                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                                                } items-center group`}
                                            >
                                                <div
                                                    className={`max-w-[70%] rounded-lg px-4 py-2 break-words overflow-hidden ${
                                                        message.sender_id === user?.id
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                                    }`}
                                                >
                                                    {editingMessageId === message.id ? (
                                                        <div className="space-y-2">
                                                            <textarea
                                                                value={editedContent}
                                                                onChange={(e) => setEditedContent(e.target.value)}
                                                                className={`w-full rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                                                    message.sender_id === user?.id
                                                                        ? 'bg-blue-600 text-white placeholder-blue-200 dark:bg-blue-700'
                                                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400'
                                                                }`}
                                                                rows={2}
                                                                placeholder="Редактировать сообщение..."
                                                            />
                                                            <div className="flex justify-end space-x-2">
                                                                <button
                                                                    onClick={() => handleEditMessage(message)}
                                                                    className={`p-1 rounded-full ${
                                                                        message.sender_id === user?.id
                                                                            ? 'text-white hover:bg-blue-600 dark:hover:bg-blue-800'
                                                                            : 'text-gray-600 hover:bg-gray-300 dark:text-gray-300 dark:hover:bg-gray-600'
                                                                    }`}
                                                                    title="Сохранить"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingMessageId(null)}
                                                                    className={`p-1 rounded-full ${
                                                                        message.sender_id === user?.id
                                                                            ? 'text-white hover:bg-blue-600 dark:hover:bg-blue-800'
                                                                            : 'text-gray-600 hover:bg-gray-300 dark:text-gray-300 dark:hover:bg-gray-600'
                                                                    }`}
                                                                    title="Отмена"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                                            <p
                                                                className={`text-xs mt-1 ${
                                                                    message.sender_id === user?.id
                                                                        ? 'text-blue-100'
                                                                        : 'text-gray-500 dark:text-gray-400'
                                                                }`}
                                                            >
                                                                {formatTime(message.created_at.toString())}
                                                                {!message.read && message.sender_id === user?.id && (
                                                                    <span className="ml-2">• Отправлено</span>
                                                                )}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                {message.sender_id === user?.id && editingMessageId !== message.id && (
                                                    <div className="ml-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditingMessageId(message.id);
                                                                setEditedContent(message.content);
                                                            }}
                                                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMessage(message.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Поле ввода сообщения (фиксированное снизу) */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                                <textarea
                                    ref={messageInputRef}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Напишите сообщение..."
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                                    rows={1}
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
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        Выберите контакт, чтобы начать переписку.
                    </div>
                )}
            </div>
        </div>
    );
}