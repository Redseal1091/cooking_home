<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  ArrowUpCircle,
  CheckCircle2,
  ChefHat,
  DownloadCloud,
  ExternalLink,
  GitBranch,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-vue-next';
import { useTheme, type ThemePreference } from '@/composables/useTheme';
import { clearOfflineCache } from '@/lib/offlineCache';
import {
  APP_VERSION,
  checkGithubLatestRelease,
  getSavedGithubRepo,
  setSavedGithubRepo,
  type ReleaseUpdateInfo,
} from '@/lib/appInfo';
import { useAppStore } from '@/stores/app';
import { useMobileRecipesStore } from '@/stores/recipes';
import SuggestRecipeModal from '@/components/SuggestRecipeModal.vue';

const appStore = useAppStore();
const recipesStore = useMobileRecipesStore();
const { preference, setTheme } = useTheme();

const cacheMessage = ref<string | null>(null);
const clearingCache = ref(false);

const suggestOpen = ref(false);
const toastMessage = ref<string | null>(null);

const githubRepo = ref(getSavedGithubRepo());
const showRepoEditor = ref(false);
const checkingUpdates = ref(false);
const updateError = ref<string | null>(null);
const updateInfo = ref<ReleaseUpdateInfo | null>(null);
const updateDialogRef = ref<HTMLDialogElement | null>(null);

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Системная', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
];

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = null;
  }, 4000);
}

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

function saveRepoSetting() {
  githubRepo.value = setSavedGithubRepo(githubRepo.value);
  showRepoEditor.value = false;
  showToast(`Репозиторий обновлений: ${githubRepo.value}`);
}

async function handleCheckUpdates() {
  if (!navigator.onLine) {
    updateError.value = 'Нет подключения к интернету для проверки обновлений.';
    return;
  }

  checkingUpdates.value = true;
  updateError.value = null;

  try {
    githubRepo.value = setSavedGithubRepo(githubRepo.value);
    const info = await checkGithubLatestRelease(githubRepo.value);
    if (info.hasUpdate && info.apkDownloadUrl) {
      updateInfo.value = info;
    } else {
      showToast('У вас установлена самая свежая версия Пухни!');
    }
  } catch (err) {
    updateError.value = err instanceof Error ? err.message : 'Ошибка проверки обновлений';
  } finally {
    checkingUpdates.value = false;
  }
}

watch(updateInfo, (val) => {
  const dialog = updateDialogRef.value;
  if (!dialog) return;
  if (val) {
    if (!dialog.open) dialog.showModal();
    appStore.pushBackHandler('app-update-modal', () => {
      updateDialogRef.value?.close();
    });
  } else {
    appStore.removeBackHandler('app-update-modal');
    if (dialog.open) dialog.close();
  }
});

function closeUpdateDialog() {
  appStore.removeBackHandler('app-update-modal');
  updateInfo.value = null;
}

function downloadAndInstallApk() {
  if (!updateInfo.value?.apkDownloadUrl) return;
  window.open(updateInfo.value.apkDownloadUrl, '_system');
}
</script>

<template>
  <div class="space-y-5 overflow-x-hidden px-4 pb-28 pt-5 sm:px-5">
    <header class="min-w-0">
      <p class="text-xs font-medium uppercase tracking-wider text-accent">
        Персонализация
      </p>
      <h1 class="mt-0.5 font-display text-2xl font-extrabold text-ink">
        Настройки
      </h1>
    </header>

    <!-- Предложить рецепт -->
    <section class="organic-card rounded-3xl border border-accent/25 bg-surface p-4 shadow-organic-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <ChefHat class="h-5 w-5" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="font-display text-base font-bold text-ink">Семейная коллекция</h2>
          <p class="mt-0.5 text-xs leading-relaxed text-ink-secondary">
            Нашли классный рецепт или хотите добавить своё фирменное блюдо? Отправьте идею в «Пухню».
          </p>
        </div>
      </div>

      <button
        type="button"
        class="tactile mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-semibold text-accent-contrast shadow-organic-sm hover:bg-accent-hover"
        @click="suggestOpen = true"
      >
        <Sparkles class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Предложить рецепт</span>
      </button>
    </section>

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
          class="tactile flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition-colors"
          :class="
            preference === opt.value
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-hairline bg-canvas text-ink-secondary'
          "
          :aria-pressed="preference === opt.value"
          @click="setTheme(opt.value)"
        >
          <component :is="opt.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="truncate max-w-full">{{ opt.label }}</span>
        </button>
      </div>
    </section>

    <!-- Офлайн-кэш -->
    <section class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <DownloadCloud class="h-5 w-5" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
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
            class="h-4 w-4 shrink-0"
            :class="{ 'animate-spin': recipesStore.syncingMedia }"
            aria-hidden="true"
          />
          <span class="truncate">
            {{ recipesStore.syncingMedia ? 'Сохраняем фото...' : 'Обновить и скачать все фото' }}
          </span>
        </button>

        <button
          type="button"
          :disabled="clearingCache"
          class="tactile flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-semibold text-danger disabled:opacity-50"
          @click="handleClearOfflineCache"
        >
          <Trash2 class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ clearingCache ? 'Очищаем кэш...' : 'Очистить офлайн-кэш' }}</span>
        </button>
      </div>

      <p
        v-if="cacheMessage"
        role="status"
        class="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-accent"
      >
        <CheckCircle2 class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{{ cacheMessage }}</span>
      </p>
    </section>

    <!-- Версия и обновление приложения (GitHub Releases) -->
    <section class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-ink">
            <ArrowUpCircle class="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-display text-base font-bold text-ink">О приложении</h2>
              <span class="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent tabular-nums">
                v{{ APP_VERSION }}
              </span>
            </div>
            <p class="mt-0.5 truncate text-[11px] text-ink-secondary">
              Репозиторий: {{ githubRepo }}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Настроить репозиторий GitHub"
          class="tactile shrink-0 rounded-xl bg-canvas p-2 text-ink-secondary hover:text-ink"
          @click="showRepoEditor = !showRepoEditor"
        >
          <Settings2 class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form
        v-if="showRepoEditor"
        class="mt-3 flex items-center gap-2 rounded-2xl border border-hairline bg-canvas p-2.5"
        @submit.prevent="saveRepoSetting"
      >
        <GitBranch class="h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
        <input
          v-model="githubRepo"
          type="text"
          placeholder="owner/repo"
          aria-label="GitHub репозиторий"
          class="min-w-0 flex-1 bg-transparent text-xs text-ink focus:outline-none"
        />
        <button
          type="submit"
          class="tactile shrink-0 rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-contrast"
        >
          Ок
        </button>
      </form>

      <button
        type="button"
        :disabled="checkingUpdates"
        class="tactile mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas px-4 py-3 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
        @click="handleCheckUpdates"
      >
        <Loader2 v-if="checkingUpdates" class="h-4 w-4 animate-spin shrink-0 text-accent" aria-hidden="true" />
        <ArrowUpCircle v-else class="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span class="truncate">
          {{ checkingUpdates ? 'Проверяем обновления...' : 'Проверить обновления / Обновить приложение' }}
        </span>
      </button>

      <p v-if="updateError" role="alert" class="mt-2.5 text-center text-xs text-danger">
        {{ updateError }}
      </p>
    </section>

    <!-- Модалка предложения рецепта -->
    <SuggestRecipeModal
      :open="suggestOpen"
      @close="suggestOpen = false"
      @submitted="(msg) => showToast(msg)"
    />

    <!-- Модалка найденного обновления APK -->
    <dialog
      ref="updateDialogRef"
      aria-labelledby="update-modal-title"
      class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-4xl border border-hairline bg-surface p-5 text-ink shadow-organic-lg"
      @close="closeUpdateDialog"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <span class="inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent tabular-nums">
            Доступна v{{ updateInfo?.latestVersion }}
          </span>
          <h3 id="update-modal-title" class="mt-1.5 font-display text-lg font-extrabold text-ink">
            {{ updateInfo?.releaseName || 'Новое обновление Пухни' }}
          </h3>
        </div>
        <button
          type="button"
          aria-label="Закрыть"
          class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
          @click="updateDialogRef?.close()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div
        v-if="updateInfo?.changelog"
        class="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-canvas p-3 text-xs leading-relaxed text-ink-secondary"
      >
        {{ updateInfo.changelog }}
      </div>

      <div class="mt-4 flex flex-col gap-2">
        <button
          type="button"
          class="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-semibold text-accent-contrast shadow-organic-sm"
          @click="downloadAndInstallApk"
        >
          <ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Скачать и установить обновление</span>
        </button>
        <button
          type="button"
          class="tactile w-full rounded-2xl border border-hairline bg-canvas py-2.5 text-xs font-semibold text-ink-secondary"
          @click="updateDialogRef?.close()"
        >
          Позже
        </button>
      </div>
    </dialog>

    <!-- Плавающий тост -->
    <Transition name="fade">
      <div
        v-if="toastMessage"
        role="status"
        class="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-center text-xs font-semibold text-accent-contrast shadow-organic-lg"
      >
        <CheckCircle2 class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
