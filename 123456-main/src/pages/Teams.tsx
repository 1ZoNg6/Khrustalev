import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Plus, Users, User, Search, X, Edit, Trash2 } from 'lucide-react';

interface Team {
    id: string;
    name: string;
    description: string | null;
    created_by: string;
    created_at: string;
    created_by_profile?: {
        full_name: string;
    };
    member_count?: number;
}

interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    role: string;
    created_at: string;
    profile?: {
        full_name: string;
        avatar_url: string | null;
        role: string;
    };
}

interface Profile {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
}

export default function Teams() {
    const { user } = useAuthStore();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isViewTeamModalOpen, setIsViewTeamModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);

    const canCreateTeam = user?.role === 'Администратор' || user?.role === 'Менеджер';
    const canEditTeam = user?.role === 'Администратор' || user?.role === 'Менеджер';

    useEffect(() => {
        fetchTeams();
    }, [user]);

    useEffect(() => {
        if (selectedTeam) {
            fetchTeamMembers(selectedTeam.id);
        }
    }, [selectedTeam]);

    useEffect(() => {
        const searchUsers = async () => {
            if (!searchQuery.trim() || !isCreateModalOpen) {
                setSearchResults([]);
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

                const filteredResults = data?.filter(
                    profile => !selectedMembers.some(member => member.id === profile.id)
                ) || [];

                setSearchResults(filteredResults);
            } catch (err) {
                console.error('Ошибка поиска пользователей:', err);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery, isCreateModalOpen, selectedMembers]);

    const fetchTeams = async () => {
        setLoading(true);
        setError('');

        try {
            let query = supabase
                .from('teams')
                .select(`
          *,
          created_by_profile:profiles!teams_created_by_fkey(full_name)
        `);

            const { data, error } = await query;

            if (error) throw error;

            const teamsWithCounts = await Promise.all((data || []).map(async (team) => {
                const { count, error: countError } = await supabase
                    .from('team_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('team_id', team.id);

                if (countError) {
                    console.error('Ошибка подсчета участников команды:', countError);
                    return { ...team, member_count: 0 };
                }

                return { ...team, member_count: count || 0 };
            }));

            setTeams(teamsWithCounts);
        } catch (err) {
            console.error('Ошибка загрузки команд:', err);
            setError('Не удалось загрузить команды');
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamMembers = async (teamId: string) => {
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select(`
          *,
          profile:profiles(*)
        `)
                .eq('team_id', teamId);

            if (error) throw error;
            setTeamMembers(data || []);
        } catch (err) {
            console.error('Ошибка загрузки участников команды:', err);
        }
    };

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!teamName.trim()) {
            setError('Название команды обязательно');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .insert([
                    {
                        name: teamName.trim(),
                        description: teamDescription.trim() || null,
                        created_by: user.id
                    }
                ])
                .select();

            if (teamError) throw teamError;

            if (!teamData || teamData.length === 0) {
                throw new Error('Не удалось создать команду');
            }

            const teamId = teamData[0].id;

            if (selectedMembers.length > 0) {
                const memberInserts = selectedMembers.map(member => ({
                    team_id: teamId,
                    user_id: member.id,
                    role: 'member'
                }));

                const { error: membersError } = await supabase
                    .from('team_members')
                    .insert(memberInserts);

                if (membersError) throw membersError;
            }

            const { error: creatorError } = await supabase
                .from('team_members')
                .insert([
                    {
                        team_id: teamId,
                        user_id: user.id,
                        role: 'Администратор'
                    }
                ]);

            if (creatorError) throw creatorError;

            setTeamName('');
            setTeamDescription('');
            setSelectedMembers([]);
            setIsCreateModalOpen(false);
            fetchTeams();
        } catch (err) {
            console.error('Ошибка создания команды:', err);
            setError('Не удалось создать команду');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedTeam) return;

        if (!teamName.trim()) {
            setError('Название команды обязательно');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: teamError } = await supabase
                .from('teams')
                .update({
                    name: teamName.trim(),
                    description: teamDescription.trim() || null
                })
                .eq('id', selectedTeam.id);

            if (teamError) throw teamError;

            setIsEditMode(false);
            setIsViewTeamModalOpen(false);
            fetchTeams();
        } catch (err) {
            console.error('Ошибка обновления команды:', err);
            setError('Не удалось обновить команду');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTeam = async () => {
        if (!user || !selectedTeam) return;

        if (!confirm('Вы уверены, что хотите удалить эту команду? Это действие нельзя отменить.')) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: teamError } = await supabase
                .from('teams')
                .delete()
                .eq('id', selectedTeam.id);

            if (teamError) throw teamError;

            setIsViewTeamModalOpen(false);
            fetchTeams();
        } catch (err) {
            console.error('Ошибка удаления команды:', err);
            setError('Не удалось удалить команду');
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (memberId: string) => {
        if (!user || !selectedTeam) return;

        try {
            const { error } = await supabase
                .from('team_members')
                .insert([
                    {
                        team_id: selectedTeam.id,
                        user_id: memberId,
                        role: 'member'
                    }
                ]);

            if (error) throw error;
            fetchTeamMembers(selectedTeam.id);
        } catch (err) {
            console.error('Ошибка добавления участника команды:', err);
            setError('Не удалось добавить участника команды');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!user || !selectedTeam) return;

        try {
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('team_id', selectedTeam.id)
                .eq('user_id', memberId);

            if (error) throw error;
            fetchTeamMembers(selectedTeam.id);
        } catch (err) {
            console.error('Ошибка удаления участника команды:', err);
            setError('Не удалось удалить участника команды');
        }
    };

    const handleViewTeam = (team: Team) => {
        setSelectedTeam(team);
        setTeamName(team.name);
        setTeamDescription(team.description || '');
        setIsViewTeamModalOpen(true);
        setIsEditMode(false);
    };

    const handleSelectMember = (profile: Profile) => {
        setSelectedMembers([...selectedMembers, profile]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveSelectedMember = (profileId: string) => {
        setSelectedMembers(selectedMembers.filter(member => member.id !== profileId));
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU');
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Команды</h1>

                    {canCreateTeam && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Создать команду
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {loading && teams.length === 0 ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : teams.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <Users className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Нет команд</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {canCreateTeam
                                ? 'Начните с создания новой команды.'
                                : 'Команды отсутствуют. Обратитесь к менеджеру для создания команды.'}
                        </p>
                        {canCreateTeam && (
                            <div className="mt-6">
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Создать команду
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map(team => (
                            <div
                                key={team.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 cursor-pointer"
                                onClick={() => handleViewTeam(team)}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{team.name}</h3>
                                    <div className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        {team.member_count} {team.member_count === 1 ? 'участник' : 'участников'}
                                    </div>
                                </div>

                                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                                    {team.description || 'Описание отсутствует.'}
                                </p>

                                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                                    <span>Создал: {team.created_by_profile?.full_name || 'Неизвестно'}</span>
                                    <span>{formatDate(team.created_at)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Модальное окно создания команды */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Создать новую команду</h2>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTeam} className="space-y-4">
                            <div>
                                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Название команды
                                </label>
                                <input
                                    type="text"
                                    id="teamName"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Описание
                                </label>
                                <textarea
                                    id="teamDescription"
                                    value={teamDescription}
                                    onChange={(e) => setTeamDescription(e.target.value)}
                                    rows={3}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Участники команды
                                </label>
                                <div className="relative mt-1">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Поиск пользователей для добавления..."
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
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                                            {searchResults.map((profile) => (
                                                <button
                                                    key={profile.id}
                                                    type="button"
                                                    onClick={() => handleSelectMember(profile)}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                >
                                                    {profile.full_name} ({profile.role === 'Администратор' ? 'Администратор' : profile.role === 'Менеджер' ? 'Менеджер' : 'Участник'})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedMembers.length > 0 && (
                                    <div className="mt-2">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Выбранные участники:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedMembers.map(member => (
                                                <div
                                                    key={member.id}
                                                    className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center"
                                                >
                                                    {member.full_name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSelectedMember(member.id)}
                                                        className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:focus:ring-offset-gray-900"
                                >
                                    {loading ? 'Создание...' : 'Создать команду'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модальное окно просмотра/редактирования команды */}
            {isViewTeamModalOpen && selectedTeam && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {isEditMode ? 'Редактировать команду' : 'Детали команды'}
                            </h2>
                            <div className="flex items-center space-x-2">
                                {canEditTeam && !isEditMode && (
                                    <>
                                        <button
                                            onClick={() => setIsEditMode(true)}
                                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        >
                                            <Edit className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={handleDeleteTeam}
                                            className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => {
                                        setIsViewTeamModalOpen(false);
                                        setIsEditMode(false);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {isEditMode ? (
                            <form onSubmit={handleUpdateTeam} className="space-y-4">
                                <div>
                                    <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Название команды
                                    </label>
                                    <input
                                        type="text"
                                        id="teamName"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Описание
                                    </label>
                                    <textarea
                                        id="teamDescription"
                                        value={teamDescription}
                                        onChange={(e) => setTeamDescription(e.target.value)}
                                        rows={3}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditMode(false)}
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
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{selectedTeam.name}</h3>
                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {selectedTeam.description || 'Описание отсутствует.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <div className="flex items-center mb-2">
                                            <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Создал</h4>
                                        </div>
                                        <p className="text-gray-900 dark:text-white">
                                            {selectedTeam.created_by_profile?.full_name || 'Неизвестно'}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <div className="flex items-center mb-2">
                                            <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Участников</h4>
                                        </div>
                                        <p className="text-gray-900 dark:text-white">
                                            {teamMembers.length} {teamMembers.length === 1 ? 'участник' : 'участников'}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Участники команды</h4>
                                        {canEditTeam && (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Добавить участника..."
                                                    className="block w-full rounded-md border-gray-300 dark:border-gray-700 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-900 dark:text-white text-sm"
                                                />
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Search className="h-4 w-4 text-gray-400" />
                                                </div>

                                                {searchResults.length > 0 && (
                                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                                                        {searchResults.map((profile) => (
                                                            <button
                                                                key={profile.id}
                                                                type="button"
                                                                onClick={() => handleAddMember(profile.id)}
                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                            >
                                                                {profile.full_name} ({profile.role === 'Администратор' ? 'Администратор' : profile.role === 'Менеджер' ? 'Менеджер' : 'Участник'})
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {teamMembers.length > 0 ? (
                                        <div className="space-y-2">
                                            {teamMembers.map(member => (
                                                <div
                                                    key={member.id}
                                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                                >
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0">
                                                            {member.profile?.avatar_url ? (
                                                                <img
                                                                    src={member.profile.avatar_url}
                                                                    alt={member.profile?.full_name}
                                                                    className="h-8 w-8 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                                                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="ml-3">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {member.profile?.full_name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                                                {member.profile?.role === 'Администратор' ? 'Администратор' : member.profile?.role === 'Менеджер' ? 'Менеджер' : 'Участник'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {canEditTeam && member.user_id !== user?.id && (
                                                        <button
                                                            onClick={() => handleRemoveMember(member.user_id)}
                                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">Участников пока нет</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}