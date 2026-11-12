<script setup lang="ts">
import { ref } from 'vue';
import {
  CheckCircle2,
  DownloadCloud,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
} from 'lucide-vue-next';
import { useTheme, type ThemePreference } from '@/composables/useTheme';
import { clearOfflineCache } from '@/lib/offlineCache';
import { useMobileRecipesStore } from '@/stores/recipes';

const recipesStore = useMobileRecipesStore();
const { preference, setTheme } = useTheme();

const cacheMessage = ref<string | null>(null);
const clearingCache = ref(false);

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Системная', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
];

async function refreshOfflineCache() {
  cacheMessage.value = null;
  await recipesStore.fetchRecipes();
  await recipesStore.precacheAllMedia();
  cacheMessage.value = `Синхронизировано рецептов: ${recipesStore.recipes.length}`;
  setTimeout(() => {
    cacheMessage.value = null;
  }, 3500);
}

async function handleClearOfflineCache() {
  clearingCache.value = true;
  cacheMessage.value = null;
  try {
    await clearOfflineCache();
    recipesStore.cachedMediaCount = 0;
    if (navigator.onLine) {
      await recipesStore.fetchRecipes();
      cacheMessage.value = 'Кэш очищен и рецепты загружены заново';
    } else {
      recipesStore.recipes = [];
      cacheMessage.value = 'Офлайн-кэш полностью очищен';
    }
    setTimeout(() => {
      cacheMessage.value = null;
    }, 3500);
  } finally {
    clearingCache.value = false;
  }
}
</script>

<template>
  <div class="space-y-5 px-5 pb-28 pt-5">
    <header>
      <p class="text-xs font-medium uppercase tracking-wider text-accent">
        Персонализация
      </p>
      <h1 class="mt-0.5 font-display text-2xl font-extrabold text-ink">
        Настройки
      </h1>
    </header>

    <!-- Тема оформления -->
    <section class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
      <h2 class="font-display text-base font-bold text-ink">Оформление</h2>
      <p class="mt-0.5 text-xs text-ink-secondary">
        Выберите светлую, тёмную или автоматическую тему по настройкам Android.
      </p>

      <div class="mt-3 grid grid-cols-3 gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="tactile flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition-colors"
          :class="
            preference === opt.value
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-hairline bg-canvas text-ink-secondary'
          "
          :aria-pressed="preference === opt.value"
          @click="setTheme(opt.value)"
        >
          <component :is="opt.icon" class="h-4 w-4" aria-hidden="true" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </section>

    <!-- Офлайн-кэш -->
    <section class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <DownloadCloud class="h-5 w-5" aria-hidden="true" />
        </div>
        <div class="flex-1">
          <h2 class="font-display text-base font-bold text-ink">Офлайн-режим и кэш</h2>
          <p class="mt-0.5 text-xs text-ink-secondary tabular-nums">
            В памяти устройства: {{ recipesStore.recipes.length }} рецептов и сохранённые фото.
          </p>
        </div>
      </div>

      <div class="mt-4 space-y-2.5">
        <button
          type="button"
          :disabled="recipesStore.syncingMedia || recipesStore.isOffline"
          class="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-xs font-semibold text-accent disabled:opacity-50"
          @click="refreshOfflineCache"
        >
          <RefreshCw
            class="h-4 w-4"
            :class="{ 'animate-spin': recipesStore.syncingMedia }"
            aria-hidden="true"
          />
          <span>
            {{ recipesStore.syncingMedia ? 'Сохраняем фото...' : 'Обновить и скачать все фото' }}
          </span>
        </button>

        <button
          type="button"
          :disabled="clearingCache"
          class="tactile flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-semibold text-danger disabled:opacity-50"
          @click="handleClearOfflineCache"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
          <span>{{ clearingCache ? 'Очищаем кэш...' : 'Очистить офлайн-кэш' }}</span>
        </button>
      </div>

      <p
        v-if="cacheMessage"
        role="status"
        class="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-accent"
      >
        <CheckCircle2 class="h-3.5 w-3.5" aria-hidden="true" />
        {{ cacheMessage }}
      </p>
    </section>
  </div>
</template>
