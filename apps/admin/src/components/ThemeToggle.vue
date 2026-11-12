<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import { useTheme, type ThemePreference } from '@/composables/useTheme';

const { preference, setTheme } = useTheme();

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Авто', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
];
</script>

<template>
  <div
    class="inline-flex items-center rounded-full border border-hairline bg-surface-muted/80 p-1"
    role="group"
    aria-label="Выбор темы оформления"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="tactile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
      :class="
        preference === opt.value
          ? 'bg-surface text-ink shadow-organic-sm'
          : 'text-ink-secondary hover:text-ink'
      "
      :aria-pressed="preference === opt.value"
      @click="setTheme(opt.value)"
    >
      <component :is="opt.icon" class="h-3.5 w-3.5" aria-hidden="true" />
      <span>{{ opt.label }}</span>
    </button>
  </div>
</template>
