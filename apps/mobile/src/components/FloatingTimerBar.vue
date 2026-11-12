<script setup lang="ts">
import { BellRing, Pause, Play, Timer, X } from 'lucide-vue-next';
import { useTimers } from '@/composables/useTimers';

const { activeTimer, formattedRemaining, progressPercent, togglePause, dismissTimer } =
  useTimers();
</script>

<template>
  <Transition name="sheet">
    <div
      v-if="activeTimer"
      role="region"
      aria-label="Активный таймер готовки"
      class="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md overflow-hidden rounded-3xl border border-hairline bg-surface/95 p-3.5 shadow-organic-lg backdrop-blur-xl"
    >
      <!-- Полоса прогресса -->
      <div
        class="absolute inset-x-0 top-0 h-1 bg-accent transition-all duration-500"
        :style="{ width: `${progressPercent}%` }"
      />

      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            :class="
              activeTimer.finished
                ? 'animate-bounce bg-warm text-white'
                : 'bg-accent-soft text-accent'
            "
          >
            <BellRing v-if="activeTimer.finished" class="h-5 w-5" aria-hidden="true" />
            <Timer v-else class="h-5 w-5" aria-hidden="true" />
          </div>

          <div class="min-w-0">
            <div class="font-display text-lg font-extrabold leading-none text-ink tabular-nums">
              {{ activeTimer.finished ? 'Готово!' : formattedRemaining }}
            </div>
            <p class="mt-0.5 truncate text-[11px] text-ink-secondary">
              {{ activeTimer.label }}
              <template v-if="activeTimer.recipeTitle">
                · {{ activeTimer.recipeTitle }}
              </template>
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <button
            v-if="!activeTimer.finished"
            type="button"
            :aria-label="activeTimer.paused ? 'Продолжить таймер' : 'Пауза'"
            class="tactile flex h-9 w-9 items-center justify-center rounded-2xl bg-surface-muted text-ink"
            @click="togglePause"
          >
            <Play v-if="activeTimer.paused" class="h-4 w-4" aria-hidden="true" />
            <Pause v-else class="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label="Закрыть таймер"
            class="tactile flex h-9 w-9 items-center justify-center rounded-2xl bg-danger/10 text-danger"
            @click="dismissTimer"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
