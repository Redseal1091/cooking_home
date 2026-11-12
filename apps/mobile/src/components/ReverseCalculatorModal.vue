<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Scale, X } from 'lucide-vue-next';
import { formatAmount, getScaleFactorByIngredient, type ScaledIngredient } from '@cookbook/shared';
import { useAppStore } from '@/stores/app';

const props = defineProps<{
  open: boolean;
  ingredient: ScaledIngredient | null;
}>();

const emit = defineEmits<{
  close: [];
  apply: [newFactor: number];
}>();

const appStore = useAppStore();
const availableAmount = ref<string>('');
const HANDLER_ID = 'reverse-calc-modal';

const isVisible = computed(() => props.open && Boolean(props.ingredient));

function requestClose() {
  appStore.removeBackHandler(HANDLER_ID);
  emit('close');
}

watch(
  isVisible,
  (visible) => {
    if (visible && props.ingredient) {
      availableAmount.value = String(props.ingredient.scaledAmount ?? props.ingredient.amount ?? '');
      appStore.pushBackHandler(HANDLER_ID, requestClose);
    } else {
      appStore.removeBackHandler(HANDLER_ID);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  appStore.removeBackHandler(HANDLER_ID);
});

const parsedValue = computed(() => {
  const num = Number.parseFloat(availableAmount.value.replace(',', '.'));
  return Number.isNaN(num) || num <= 0 ? null : num;
});

const previewFactor = computed(() => {
  if (!props.ingredient || !parsedValue.value) return null;
  return getScaleFactorByIngredient(props.ingredient.amount, parsedValue.value);
});

function handleSubmit() {
  if (!previewFactor.value) return;
  emit('apply', previewFactor.value);
  requestClose();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reverse-calc-title"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pt-[max(18dvh,calc(env(safe-area-inset-top)+3rem))] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6"
      @click.self="requestClose"
    >
      <div
        class="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-organic-lg sm:rounded-3xl"
        @click.stop
        @mousedown.stop
        @touchstart.stop
      >
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Scale class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 id="reverse-calc-title" class="font-display text-base font-bold text-ink">
                Пересчёт от остатков
              </h3>
              <p class="truncate text-xs text-ink-secondary">
                {{ ingredient?.name }}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Закрыть"
            class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
            @click="requestClose"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          @submit.prevent="handleSubmit"
        >
          <div class="rounded-2xl bg-canvas/70 px-4 py-3 text-xs text-ink-secondary">
            По базовому рецепту нужно:
            <strong class="font-semibold text-ink tabular-nums">
              {{ formatAmount(ingredient?.amount ?? null) }} {{ ingredient?.unit }}
            </strong>
          </div>

          <div>
            <label for="available-weight" class="mb-1.5 block text-xs font-semibold text-ink">
              Сколько у вас есть сейчас ({{ ingredient?.unit }})?
            </label>
            <input
              id="available-weight"
              v-model="availableAmount"
              type="number"
              step="any"
              min="0.01"
              inputmode="decimal"
              required
              class="w-full rounded-2xl border border-hairline bg-canvas px-4 py-3 text-base font-bold text-ink tabular-nums focus:border-accent focus:outline-none"
            />
          </div>

          <div
            v-if="previewFactor"
            class="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-2.5 text-xs font-medium text-accent tabular-nums"
          >
            <span>Новый коэффициент блюда:</span>
            <strong class="text-sm font-bold">{{ previewFactor.toFixed(2).replace('.', ',') }}x</strong>
          </div>

          <div class="flex gap-2.5 pt-1">
            <button
              type="button"
              class="tactile flex-1 rounded-2xl border border-hairline bg-canvas py-3 text-xs font-semibold text-ink"
              @click="requestClose"
            >
              Отмена
            </button>
            <button
              type="submit"
              :disabled="!previewFactor"
              class="tactile flex-1 rounded-2xl bg-accent py-3 text-xs font-semibold text-accent-contrast shadow-organic-sm disabled:opacity-50"
            >
              Пересчитать всё
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
