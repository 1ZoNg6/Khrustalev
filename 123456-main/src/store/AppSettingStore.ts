import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AppSettings {
    appName: string;
    primaryColor: string;
    logoUrl: string | null;
}

interface AppSettingsState {
    appName: string;
    primaryColor: string;
    logoUrl: string | null;
    loading: boolean;
    updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
    loadSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
    appName: 'TaskManager',
    primaryColor: '#3b82f6', // blue-500
    logoUrl: null,
    loading: false,

    loadSettings: async () => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .single();

            if (error) {
                if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
                    console.error('Error loading app settings:', error);
                }
                // If no settings found, we'll use the defaults
                return;
            }

            if (data) {
                set({
                    appName: data.app_name || 'TaskManager',
                    primaryColor: data.primary_color || '#3b82f6',
                    logoUrl: data.logo_url,
                });
            }
        } catch (err) {
            console.error('Error loading app settings:', err);
        } finally {
            set({ loading: false });
        }
    },

    updateSettings: async (settings: Partial<AppSettings>) => {
        set({ loading: true });
        try {
            // First check if settings exist
            const { data: existingData, error: checkError } = await supabase
                .from('app_settings')
                .select('id')
                .limit(1);

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            const updatedSettings = {
                app_name: settings.appName !== undefined ? settings.appName : get().appName,
                primary_color: settings.primaryColor !== undefined ? settings.primaryColor : get().primaryColor,
                logo_url: settings.logoUrl !== undefined ? settings.logoUrl : get().logoUrl,
            };

            let error;
            if (existingData && existingData.length > 0) {
                // Update existing settings
                const { error: updateError } = await supabase
                    .from('app_settings')
                    .update(updatedSettings)
                    .eq('id', existingData[0].id);
                error = updateError;
            } else {
                // Insert new settings
                const { error: insertError } = await supabase
                    .from('app_settings')
                    .insert([updatedSettings]);
                error = insertError;
            }

            if (error) throw error;

            set({
                appName: updatedSettings.app_name,
                primaryColor: updatedSettings.primary_color,
                logoUrl: updatedSettings.logo_url,
            });
        } catch (err) {
            console.error('Error updating app settings:', err);
            throw err;
        } finally {
            set({ loading: false });
        }
    },
}));