import { ref } from 'vue';
import { defineStore } from 'pinia';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/offlineCache';

interface BackHandlerEntry {
  key: string;
  close: () => void;
}

export const useAppStore = defineStore('mobile-app', () => {
  const onboardingSeen = ref(true);
  const initializing = ref(true);
  const backStack = ref<BackHandlerEntry[]>([]);

  async function init() {
    initializing.value = true;
    try {
      onboardingSeen.value = await hasSeenOnboarding();
    } catch {
      onboardingSeen.value = true;
    } finally {
      initializing.value = false;
    }
  }

  async function completeOnboarding() {
    onboardingSeen.value = true;
    await markOnboardingSeen();
  }

  function pushBackHandler(key: string, close: () => void) {
    backStack.value = [...backStack.value.filter((entry) => entry.key !== key), { key, close }];
  }

  function removeBackHandler(key: string) {
    backStack.value = backStack.value.filter((entry) => entry.key !== key);
  }

  function closeTopModal(): boolean {
    const top = backStack.value[backStack.value.length - 1];
    if (!top) return false;
    backStack.value = backStack.value.slice(0, -1);
    top.close();
    return true;
  }

  return {
    onboardingSeen,
    initializing,
    init,
    completeOnboarding,
    pushBackHandler,
    removeBackHandler,
    closeTopModal,
  };
});
