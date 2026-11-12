<script setup lang="ts">
import { BookOpen, Settings, ShoppingBasket } from 'lucide-vue-next';

export type MobileTab = 'catalog' | 'shopping' | 'settings';

defineProps<{
  activeTab: MobileTab;
  shoppingBadge: number;
}>();

const emit = defineEmits<{
  change: [tab: MobileTab];
}>();
</script>

<template>
  <nav
    aria-label="Основная навигация"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/90 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
  >
    <div class="mx-auto grid max-w-md grid-cols-3 gap-2">
      <button
        type="button"
        class="tactile flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors"
        :class="activeTab === 'catalog' ? 'text-accent' : 'text-ink-tertiary'"
        @click="emit('change', 'catalog')"
      >
        <BookOpen class="h-5 w-5" aria-hidden="true" />
        <span>Рецепты</span>
      </button>

      <button
        type="button"
        class="tactile relative flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors"
        :class="activeTab === 'shopping' ? 'text-accent' : 'text-ink-tertiary'"
        @click="emit('change', 'shopping')"
      >
        <div class="relative">
          <ShoppingBasket class="h-5 w-5" aria-hidden="true" />
          <span
            v-if="shoppingBadge > 0"
            class="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white tabular-nums"
          >
            {{ shoppingBadge > 99 ? '99+' : shoppingBadge }}
          </span>
        </div>
        <span>Покупки</span>
      </button>

      <button
        type="button"
        class="tactile flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors"
        :class="activeTab === 'settings' ? 'text-accent' : 'text-ink-tertiary'"
        @click="emit('change', 'settings')"
      >
        <Settings class="h-5 w-5" aria-hidden="true" />
        <span>Настройки</span>
      </button>
    </div>
  </nav>
</template>
