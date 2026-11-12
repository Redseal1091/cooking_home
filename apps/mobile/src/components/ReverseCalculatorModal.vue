<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const dialogRef = ref<HTMLDialogElement | null>(null);
const availableAmount = ref<string>('');

watch(
  () => props.open,
  (isOpen) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (isOpen && props.ingredient) {
      availableAmount.value = String(props.ingredient.scaledAmount ?? props.ingredient.amount ?? '');
      if (!dialog.open) dialog.showModal();
      appStore.pushBackHandler('reverse-calc-modal', () => {
        dialogRef.value?.close();
      });
    } else {
      appStore.removeBackHandler('reverse-calc-modal');
      if (!isOpen && dialog.open) {
        dialog.close();
      }
    }
  },
);

function handleClose() {
  appStore.removeBackHandler('reverse-calc-modal');
  if (dialogRef.value) dialogRef.value.returnValue = '';
  emit('close');
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    dialogRef.value?.close();
  }
}

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
  dialogRef.value?.close();
}
</script>

<template>
  <dialog
    ref="dialogRef"
    aria-labelledby="reverse-calc-title"
    class="open:flex fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col items-center justify-end overflow-hidden border-0 bg-transparent p-0 pt-[max(18dvh,calc(env(safe-area-inset-top)+3rem))] sm:justify-center sm:px-4 sm:pb-6"
    @close="handleClose"
    @click="onBackdropClick"
  >
    <div
      class="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-b-0 border-hairline bg-surface text-ink shadow-organic-lg sm:rounded-3xl sm:border-b"
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
          @click="dialogRef?.close()"
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
          autofocus
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
          @click="dialogRef?.close()"
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
  </dialog>
</template>
