import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Preferences } from '@capacitor/preferences';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

const preference = ref<ThemePreference>(readStoredSync());
const systemIsDark = ref<boolean>(
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false,
);

function readStoredSync(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // ignore
  }
  return 'system';
}

function applyScheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const resolvedDark = pref === 'dark' || (pref === 'system' && systemIsDark.value);

  if (meta) {
    meta.content = pref === 'system' ? 'light dark' : pref;
  }

  document.documentElement.classList.toggle('dark', resolvedDark);
  document.documentElement.classList.toggle('light', pref === 'light');
}

export function useTheme() {
  let mediaQuery: MediaQueryList | null = null;

  const handleMediaChange = (e: MediaQueryListEvent) => {
    systemIsDark.value = e.matches;
    if (preference.value === 'system') {
      applyScheme('system');
    }
  };

  async function initFromPreferences() {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value === 'light' || value === 'dark') {
        preference.value = value;
        localStorage.setItem(STORAGE_KEY, value);
        applyScheme(value);
      }
    } catch {
      // ignore
    }
  }

  async function setTheme(next: ThemePreference) {
    preference.value = next;
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY);
        await Preferences.remove({ key: STORAGE_KEY });
      } else {
        localStorage.setItem(STORAGE_KEY, next);
        await Preferences.set({ key: STORAGE_KEY, value: next });
      }
    } catch {
      // ignore
    }
    applyScheme(next);
  }

  onMounted(() => {
    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemIsDark.value = mediaQuery.matches;
      mediaQuery.addEventListener('change', handleMediaChange);
    }
    void initFromPreferences();
    applyScheme(preference.value);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', handleMediaChange);
  });

  const isDark = computed(
    () => preference.value === 'dark' || (preference.value === 'system' && systemIsDark.value),
  );

  return {
    preference,
    isDark,
    setTheme,
  };
}
