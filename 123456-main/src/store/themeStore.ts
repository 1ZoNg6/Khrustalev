import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            darkMode: false,
            toggleDarkMode: () =>
                set((state) => {
                    const newDarkMode = !state.darkMode;
                    if (newDarkMode) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                    return { darkMode: newDarkMode };
                }),
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                // Apply theme on page load
                if (state?.darkMode) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            },
        }
    )
);

// Initialize theme based on system preference if no stored preference
if (typeof window !== 'undefined') {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (!localStorage.getItem('theme-storage') && darkModeMediaQuery.matches) {
        useThemeStore.setState({ darkMode: true });
        document.documentElement.classList.add('dark');
    }
}