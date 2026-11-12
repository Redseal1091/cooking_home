<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Delete, RotateCcw, Scale, X } from 'lucide-vue-next';
import { formatAmount, getScaleFactorByIngredient, type ScaledIngredient } from '@cookbook/shared';
import { useBackdropDismiss } from '@/composables/useBackdropDismiss';
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
const rawInput = ref<string>('');
const isPristine = ref<boolean>(true);
const HANDLER_ID = 'reverse-calc-modal';

const isVisible = computed(() => props.open && Boolean(props.ingredient));

function formatForInput(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val) || val <= 0) return '';
  const rounded = Math.round(val * 100) / 100;
  return String(rounded).replace('.', ',');
}

function requestClose() {
  appStore.removeBackHandler(HANDLER_ID);
  emit('close');
}

const {
  onBackdropPointerDown,
  onBackdropPointerUp,
  onBackdropPointerCancel,
} = useBackdropDismiss(requestClose);

watch(
  isVisible,
  (visible) => {
    if (visible && props.ingredient) {
      rawInput.value = formatForInput(props.ingredient.scaledAmount ?? props.ingredient.amount);
      isPristine.value = true;
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
  const normalized = rawInput.value.replace(',', '.');
  if (!normalized || normalized === '.') return null;
  const num = Number.parseFloat(normalized);
  return Number.isNaN(num) || num <= 0 ? null : num;
});

const previewFactor = computed(() => {
  if (!props.ingredient || !parsedValue.value) return null;
  return getScaleFactorByIngredient(props.ingredient.amount, parsedValue.value);
});

function pressDigit(digit: string) {
  if (isPristine.value) {
    rawInput.value = digit;
    isPristine.value = false;
    return;
  }

  if (rawInput.value === '0') {
    rawInput.value = digit;
    return;
  }

  const parts = rawInput.value.split(',');
  if (parts[1] && parts[1].length >= 2) return;
  if (rawInput.value.length >= 9) return;

  rawInput.value += digit;
}

function pressDecimal() {
  if (isPristine.value) {
    rawInput.value = '0,';
    isPristine.value = false;
    return;
  }

  if (rawInput.value.includes(',')) return;
  rawInput.value = rawInput.value === '' ? '0,' : `${rawInput.value},`;
}

function pressBackspace() {
  isPristine.value = false;
  if (rawInput.value.length <= 1) {
    rawInput.value = '';
  } else {
    rawInput.value = rawInput.value.slice(0, -1);
  }
}

function pressClear() {
  isPristine.value = false;
  rawInput.value = '';
}

function adjustBy(delta: number) {
  const current = parsedValue.value ?? 0;
  const next = Math.max(0, Math.round((current + delta) * 100) / 100);
  rawInput.value = next > 0 ? String(next).replace('.', ',') : '';
  isPristine.value = false;
}

function handleSubmit() {
  if (!previewFactor.value) return;
  emit('apply', previewFactor.value);
  requestClose();
}

function handleResetToOne() {
  emit('apply', 1);
  requestClose();
}

const digitRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reverse-calc-title"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pt-[max(20dvh,calc(env(safe-area-inset-top)+3rem))] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6"
      @pointerdown="onBackdropPointerDown"
      @pointerup="onBackdropPointerUp"
      @pointercancel="onBackdropPointerCancel"
    >
      <div
        class="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-organic-lg sm:rounded-3xl"
        @pointerdown.stop
        @pointerup.stop
        @click.stop
      >
        <!-- Шапка модалки -->
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Scale class="h-4 w-4" aria-hidden="true" />
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

        <!-- Тело калькулятора -->
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <!-- База и живой коэффициент в одну компактную строку -->
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-canvas/80 px-3.5 py-2 text-xs">
            <span class="text-ink-secondary">
              По 1x:
              <strong class="font-bold text-ink tabular-nums">
                {{ formatAmount(ingredient?.amount ?? null) }} {{ ingredient?.unit }}
              </strong>
            </span>

            <span
              v-if="previewFactor"
              class="rounded-full bg-accent-soft px-2.5 py-0.5 font-bold text-accent tabular-nums"
            >
              {{ previewFactor.toFixed(2).replace('.', ',') }}x
            </span>
            <span v-else class="text-[11px] text-ink-tertiary">
              Введите больше 0
            </span>
          </div>

          <!-- Кастомный дисплей без вызова системной клавиатуры Android -->
          <div>
            <p id="available-weight-label" class="mb-1.5 text-xs font-semibold text-ink">
              Сколько у вас есть сейчас ({{ ingredient?.unit }})?
            </p>
            <div
              role="textbox"
              aria-readonly="true"
              aria-labelledby="available-weight-label"
              class="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas px-4 py-2.5 select-none"
            >
              <input
                id="available-weight"
                type="text"
                readonly
                inputmode="none"
                tabindex="-1"
                aria-hidden="true"
                :value="rawInput"
                class="sr-only pointer-events-none"
              />
              <div class="flex min-w-0 items-center text-2xl font-extrabold tracking-tight tabular-nums">
                <span
                  :class="
                    !rawInput
                      ? 'text-ink-tertiary'
                      : isPristine
                        ? 'text-accent'
                        : 'text-ink'
                  "
                >
                  {{ rawInput || '0' }}
                </span>
                <span
                  aria-hidden="true"
                  class="caret-blink ml-0.5 inline-block h-6 w-0.5 shrink-0 rounded-full bg-accent"
                />
              </div>
              <span class="shrink-0 rounded-xl bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-secondary">
                {{ ingredient?.unit }}
              </span>
            </div>
          </div>

          <!-- Быстрые пресеты и очистка -->
          <div class="grid grid-cols-3 gap-2 select-none" style="touch-action: manipulation">
            <button
              type="button"
              class="h-10 rounded-2xl border border-hairline bg-canvas text-xs font-bold text-ink tabular-nums transition-transform active:scale-95"
              @click="adjustBy(-50)"
            >
              −50
            </button>
            <button
              type="button"
              aria-label="Очистить"
              class="h-10 rounded-2xl bg-danger/10 text-xs font-extrabold text-danger transition-transform active:scale-95"
              @click="pressClear"
            >
              C
            </button>
            <button
              type="button"
              class="h-10 rounded-2xl border border-hairline bg-canvas text-xs font-bold text-ink tabular-nums transition-transform active:scale-95"
              @click="adjustBy(50)"
            >
              +50
            </button>
          </div>

          <!-- Встроенная цифровая клавиатура (Numpad) -->
          <div class="grid grid-cols-3 gap-2 select-none" style="touch-action: manipulation">
            <template v-for="row in digitRows" :key="row.join('-')">
              <button
                v-for="digit in row"
                :key="digit"
                type="button"
                class="flex h-12 items-center justify-center rounded-2xl bg-surface-muted text-lg font-bold text-ink tabular-nums transition-transform active:scale-95 active:bg-accent-soft active:text-accent"
                @click="pressDigit(digit)"
              >
                {{ digit }}
              </button>
            </template>

            <button
              type="button"
              aria-label="Десятичная запятая"
              class="flex h-12 items-center justify-center rounded-2xl bg-surface-muted text-xl font-bold text-ink transition-transform active:scale-95 active:bg-accent-soft active:text-accent"
              @click="pressDecimal"
            >
              ,
            </button>
            <button
              type="button"
              class="flex h-12 items-center justify-center rounded-2xl bg-surface-muted text-lg font-bold text-ink tabular-nums transition-transform active:scale-95 active:bg-accent-soft active:text-accent"
              @click="pressDigit('0')"
            >
              0
            </button>
            <button
              type="button"
              aria-label="Удалить символ"
              class="flex h-12 items-center justify-center rounded-2xl bg-surface-muted text-ink-secondary transition-transform active:scale-95 active:bg-accent-soft active:text-accent"
              @click="pressBackspace"
            >
              <Delete class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <!-- Кнопки действия -->
          <div class="space-y-2 pt-1">
            <button
              type="button"
              :disabled="!previewFactor"
              class="flex h-12 w-full items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-accent-contrast shadow-organic-sm transition-transform active:scale-[0.98] disabled:opacity-50"
              @click="handleSubmit"
            >
              Пересчитать рецепт
            </button>
            <button
              type="button"
              class="flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-hairline bg-canvas text-xs font-semibold text-ink-secondary transition-transform active:scale-[0.98]"
              @click="handleResetToOne"
            >
              <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
              <span>Сбросить к 1x</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes caret-pulse {
  0%, 49% {
    opacity: 1;
  }
  50%, 100% {
    opacity: 0;
  }
}

.caret-blink {
  animation: caret-pulse 1.05s infinite;
}
</style>
