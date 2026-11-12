import { onMounted, onUnmounted, ref } from 'vue';
import { KeepAwake } from '@capacitor-community/keep-awake';

export function useWakeLock() {
  const active = ref(false);
  let webSentinel: WakeLockSentinel | null = null;

  async function enable() {
    try {
      await KeepAwake.keepAwake();
      active.value = true;
      return;
    } catch {
      // Web fallback
    }

    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        webSentinel = await navigator.wakeLock.request('screen');
        active.value = true;
      }
    } catch {
      active.value = false;
    }
  }

  async function disable() {
    active.value = false;
    try {
      await KeepAwake.allowSleep();
    } catch {
      // ignore
    }
    try {
      if (webSentinel) {
        await webSentinel.release();
        webSentinel = null;
      }
    } catch {
      // ignore
    }
  }

  onMounted(() => {
    void enable();
  });

  onUnmounted(() => {
    void disable();
  });

  return {
    wakeLockActive: active,
    enable,
    disable,
  };
}
