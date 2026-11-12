<script setup lang="ts">
import { ArrowUpCircle, Loader2, X } from 'lucide-vue-next';
import { useAppUpdater } from '@/composables/useAppUpdater';

defineProps<{
  hasBottomBar?: boolean;
}>();

const {
  availableUpdate,
  showUpdateBanner,
  downloadingUpdate,
  downloadProgress,
  downloadIndeterminate,
  downloadError,
  dismissUpdateBanner,
  downloadAndInstallUpdate,
} = useAppUpdater();
</script>

<template>
  <Transition name="banner-up">
    <div
      v-if="showUpdateBanner && availableUpdate"
      role="status"
      class="fixed inset-x-3 z-40 mx-auto max-w-md transition-[bottom] duration-200"
      :class="
        hasBottomBar
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
          : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
      "
    >
      <div class="organic-card overflow-hidden rounded-3xl border border-hairline bg-surface/95 p-3.5 shadow-organic-lg backdrop-blur-xl">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Loader2
              v-if="downloadingUpdate"
              class="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            <ArrowUpCircle v-else class="h-4 w-4" aria-hidden="true" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate font-display text-xs font-bold text-ink">
              {{
                downloadingUpdate
                  ? downloadIndeterminate
                    ? 'Скачивание обновления...'
                    : `Скачивание обновления... ${downloadProgress ?? 0}%`
                  : `Доступна новая версия Пухни (v${availableUpdate.latestVersion})!`
              }}
            </p>
            <p v-if="downloadError" class="mt-0.5 truncate text-[11px] text-danger">
              {{ downloadError }}
            </p>
            <p v-else-if="downloadingUpdate" class="mt-0.5 truncate text-[11px] text-ink-secondary">
              После загрузки откроется системный установщик
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              :disabled="downloadingUpdate"
              class="tactile rounded-2xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-contrast shadow-organic-sm disabled:opacity-70 tabular-nums"
              @click="downloadAndInstallUpdate(availableUpdate)"
            >
              {{
                downloadingUpdate
                  ? downloadIndeterminate
                    ? '...'
                    : `${downloadProgress ?? 0}%`
                  : 'Обновить'
              }}
            </button>

            <button
              v-if="!downloadingUpdate"
              type="button"
              aria-label="Скрыть уведомление об обновлении"
              class="tactile rounded-full bg-surface-muted p-1.5 text-ink-secondary hover:text-ink"
              @click="dismissUpdateBanner"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          v-if="downloadingUpdate"
          class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            class="h-full rounded-full bg-accent transition-[width] duration-150"
            :class="{ 'w-1/2 animate-pulse': downloadIndeterminate }"
            :style="!downloadIndeterminate ? { width: `${downloadProgress ?? 0}%` } : undefined"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.banner-up-enter-active,
.banner-up-leave-active {
  transition: opacity 0.24s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.banner-up-enter-from,
.banner-up-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
