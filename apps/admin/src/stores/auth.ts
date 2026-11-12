import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null);
  const user = ref<User | null>(null);
  const initializing = ref(true);
  const submitting = ref(false);
  const authError = ref<string | null>(null);

  const isAuthenticated = computed(() => Boolean(session.value?.user));

  let unsubscribe: (() => void) | null = null;

  async function init() {
    initializing.value = true;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session.value = data.session;
      user.value = data.session?.user ?? null;

      if (!unsubscribe) {
        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          session.value = nextSession;
          user.value = nextSession?.user ?? null;
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      }
    } catch (err) {
      authError.value = err instanceof Error ? err.message : 'Ошибка проверки сессии';
    } finally {
      initializing.value = false;
    }
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    submitting.value = true;
    authError.value = null;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        authError.value =
          error.message === 'Invalid login credentials'
            ? 'Неверный email или пароль.'
            : error.message;
        return false;
      }
      session.value = data.session;
      user.value = data.user;
      return true;
    } catch (err) {
      authError.value = err instanceof Error ? err.message : 'Не удалось выполнить вход';
      return false;
    } finally {
      submitting.value = false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    session.value = null;
    user.value = null;
  }

  return {
    session,
    user,
    initializing,
    submitting,
    authError,
    isAuthenticated,
    init,
    signIn,
    signOut,
  };
});
