import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { User, Settings, LogOut } from 'lucide-react';

export default function ProfileDropdown() {
    const { user, signOut } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className="flex items-center space-x-2 focus:outline-none"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                    {user?.avatar_url ? (
                        <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    )}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline-block">
          {user?.full_name}
        </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
                    </div>
                    <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                        onClick={() => setIsOpen(false)}
                    >
                        <User className="mr-2 h-4 w-4" />
                        Мой профиль
                    </Link>
                    <Link
                        to="/settings"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                        onClick={() => setIsOpen(false)}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        Настройки
                    </Link>
                    {user?.role === 'Администратор' && (
                        <Link
                            to="/admin"
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                            onClick={() => setIsOpen(false)}
                        >
                            <Settings className="mr-2 h-4 w-4" />
                            Панель администратора
                        </Link>
                    )}
                    <button
                        onClick={() => {
                            signOut();
                            setIsOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Выйти
                    </button>
                </div>
            )}
        </div>
    );
}