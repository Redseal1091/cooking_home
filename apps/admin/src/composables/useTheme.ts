import { computed, onMounted, onUnmounted, ref } from 'vue';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

const preference = ref<ThemePreference>(readStoredPreference());
const systemIsDark = ref<boolean>(
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false,
);

function readStoredPreference(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // ignore storage errors
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

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      preference.value = readStoredPreference();
      applyScheme(preference.value);
    }
  };

  const setTheme = (next: ThemePreference) => {
    preference.value = next;
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // ignore storage errors
    }
    applyScheme(next);
  };

  onMounted(() => {
    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemIsDark.value = mediaQuery.matches;
      mediaQuery.addEventListener('change', handleMediaChange);
    }
    window.addEventListener('storage', handleStorage);
    applyScheme(preference.value);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', handleMediaChange);
    window.removeEventListener('storage', handleStorage);
  });

  const isDark = computed(
    () => preference.value === 'dark' || (preference.value === 'system' && systemIsDark.value),
  );

  return {
    preference,
    isDark,
    systemIsDark,
    setTheme,
  };
}
