import { ref } from 'vue';
import { defineStore } from 'pinia';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/offlineCache';

export const useAppStore = defineStore('mobile-app', () => {
  const onboardingSeen = ref(true);
  const initializing = ref(true);

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

  return {
    onboardingSeen,
    initializing,
    init,
    completeOnboarding,
  };
});
