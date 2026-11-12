import { onUnmounted, ref, watch, type Ref } from 'vue';
import { getCachedMediaObjectUrl } from '@/lib/offlineCache';

export function useOfflineImage(sourceUrl: Ref<string | null | undefined> | (() => string | null | undefined)) {
  const resolvedUrl = ref<string | null>(null);
  let createdObjectUrl: string | null = null;

  function revokeCurrent() {
    if (createdObjectUrl) {
      URL.revokeObjectURL(createdObjectUrl);
      createdObjectUrl = null;
    }
  }

  async function resolve(url: string | null | undefined) {
    revokeCurrent();
    if (!url) {
      resolvedUrl.value = null;
      return;
    }

    if (navigator.onLine) {
      resolvedUrl.value = url;
      return;
    }

    const cached = await getCachedMediaObjectUrl(url);
    if (cached) {
      createdObjectUrl = cached;
      resolvedUrl.value = cached;
    } else {
      resolvedUrl.value = url;
    }
  }

  async function handleImageError() {
    const url = typeof sourceUrl === 'function' ? sourceUrl() : sourceUrl.value;
    if (!url || createdObjectUrl) return;
    const cached = await getCachedMediaObjectUrl(url);
    if (cached) {
      createdObjectUrl = cached;
      resolvedUrl.value = cached;
    }
  }

  watch(sourceUrl, (next) => {
    void resolve(next);
  }, { immediate: true });

  onUnmounted(() => {
    revokeCurrent();
  });

  return {
    resolvedUrl,
    handleImageError,
  };
}
