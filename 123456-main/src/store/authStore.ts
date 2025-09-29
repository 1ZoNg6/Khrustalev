import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { AuthError, PostgrestError } from '@supabase/supabase-js';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

interface CustomError extends Error {
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        throw signInError;
      }

      if (!authData.session?.user) {
        throw new Error('No session after sign in');
      }

      // Then fetch the profile with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let profile = null;
      let lastError: CustomError | null = null;

      while (retryCount < maxRetries && !profile) {
        try {
          const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authData.session.user.id)
              .single();

          if (error) {
            lastError = error as CustomError;
            console.error(`Profile fetch attempt ${retryCount + 1} failed:`, {
              code: lastError.code,
              details: lastError.details,
              hint: lastError.hint,
              message: lastError.message
            });
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              continue;
            }
            break;
          }

          profile = data;
          break;
        } catch (error) {
          lastError = error as CustomError;
          console.error(`Profile fetch attempt ${retryCount + 1} failed with exception:`, {
            code: lastError.code,
            details: lastError.details,
            hint: lastError.hint,
            message: lastError.message
          });
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          break;
        }
      }

      if (!profile) {
        console.error('Failed to fetch profile after retries', {
          code: lastError?.code,
          details: lastError?.details,
          hint: lastError?.hint,
          message: lastError?.message
        });
        await supabase.auth.signOut();
        throw new Error(lastError?.message || 'Failed to load profile');
      }

      set({ user: profile });
    } catch (error) {
      console.error('Authentication error:', error);

      await supabase.auth.signOut();
      set({ user: null });

      if (error instanceof AuthError) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
      }
      if (error instanceof PostgrestError) {
        const pgError = error as CustomError;
        console.error('Database error:', {
          code: pgError.code,
          details: pgError.details,
          hint: pgError.hint,
          message: pgError.message
        });
        throw new Error('Database error occurred');
      }
      throw error;
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('No user data after sign up');

      let retryCount = 0;
      const maxRetries = 3;
      let lastError: CustomError | null = null;

      while (retryCount < maxRetries) {
        try {
          const { error: profileError } = await supabase.from('profiles').insert([
            {
              id: authData.user.id,
              full_name: fullName,
              role: 'Работник',
            }
          ]);

          if (!profileError) {
            return;
          }

          lastError = profileError as CustomError;
          console.error(`Profile creation attempt ${retryCount + 1} failed:`, {
            code: lastError.code,
            details: lastError.details,
            hint: lastError.hint,
            message: lastError.message
          });
          retryCount++;

          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
        } catch (error) {
          lastError = error as CustomError;
          console.error(`Profile creation attempt ${retryCount + 1} failed with exception:`, {
            code: lastError.code,
            details: lastError.details,
            hint: lastError.hint,
            message: lastError.message
          });
          retryCount++;

          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
        }
      }

      console.error('Failed to create profile after retries', {
        code: lastError?.code,
        details: lastError?.details,
        hint: lastError?.hint,
        message: lastError?.message
      });

      // Even if profile creation fails, we don't want to delete the auth user
      // as they can try again later
      throw new Error(lastError?.message || 'Failed to create profile');
    } catch (error) {
      console.error('Sign up error:', error);

      if (error instanceof AuthError) {
        if (error.message.includes('User already registered')) {
          throw new Error('Email already registered');
        }
      }
      throw error;
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      set({ user: null });
    }
  },

  loadUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ user: null, loading: false });
        return;
      }

      let retryCount = 0;
      const maxRetries = 3;
      let profile = null;
      let lastError: CustomError | null = null;

      while (retryCount < maxRetries && !profile) {
        try {
          const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

          if (error) {
            lastError = error as CustomError;
            console.error(`Profile load attempt ${retryCount + 1} failed:`, {
              code: lastError.code,
              details: lastError.details,
              hint: lastError.hint,
              message: lastError.message
            });
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              continue;
            }
            break;
          }

          profile = data;
          break;
        } catch (error) {
          lastError = error as CustomError;
          console.error(`Profile load attempt ${retryCount + 1} failed with exception:`, {
            code: lastError.code,
            details: lastError.details,
            hint: lastError.hint,
            message: lastError.message
          });
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          break;
        }
      }

      if (!profile) {
        console.error('Failed to load profile after retries', {
          code: lastError?.code,
          details: lastError?.details,
          hint: lastError?.hint,
          message: lastError?.message
        });
        await supabase.auth.signOut();
        set({ user: null, loading: false });
        return;
      }

      set({ user: profile, loading: false });
    } catch (error) {
      console.error('Load user error:', error);
      await supabase.auth.signOut();
      set({ user: null, loading: false });
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { user } = get();
    if (!user) throw new Error('Пользователь не вошел в систему');

    try {
      const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

      if (error) throw error;

      set({ user: { ...user, ...updates } });
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      throw error;
    }
  }
}));