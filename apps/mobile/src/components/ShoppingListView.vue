<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Share } from '@capacitor/share';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Minus,
  Pencil,
  Plus,
  Radio,
  Share2,
  ShoppingBag,
  Square,
  Trash2,
  WifiOff,
  X,
} from 'lucide-vue-next';
import { formatAmount, INGREDIENT_UNITS, type ShoppingListItem } from '@cookbook/shared';
import { useBackdropDismiss } from '@/composables/useBackdropDismiss';
import { useAppStore } from '@/stores/app';
import { useShoppingListStore } from '@/stores/shoppingList';
import { useMobileRecipesStore } from '@/stores/recipes';

const appStore = useAppStore();
const shoppingStore = useShoppingListStore();
const recipesStore = useMobileRecipesStore();

const productName = ref('');
const amount = ref<number>(1);
const unit = ref<string>('шт');
const adding = ref(false);

const toastMessage = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = null;
  }, 3000);
}

// Состояние модалки "Поделиться"
const shareModalOpen = ref(false);
const shareMode = ref<'unchecked' | 'all'>('unchecked');

// Состояние модалки подтверждения полной очистки
const clearAllModalOpen = ref(false);

watch(clearAllModalOpen, (isOpen) => {
  if (isOpen) {
    appStore.pushBackHandler('clear-all-shopping-list', closeClearAllModal);
  } else {
    appStore.removeBackHandler('clear-all-shopping-list');
  }
});

function closeClearAllModal() {
  appStore.removeBackHandler('clear-all-shopping-list');
  clearAllModalOpen.value = false;
}

const clearAllBackdrop = useBackdropDismiss(closeClearAllModal);

function confirmClearAll() {
  void shoppingStore.clearAll();
  closeClearAllModal();
  showToast('Список покупок очищен');
}

// Состояние модалки редактирования пункта
const editingItem = ref<ShoppingListItem | null>(null);
const editName = ref('');
const editAmount = ref<string>('1');
const editUnit = ref('шт');
const editError = ref<string | null>(null);

async function handleAdd() {
  if (!productName.value.trim()) return;
  adding.value = true;
  try {
    await shoppingStore.addOrMergeItem(productName.value, amount.value || 1, unit.value, null);
    productName.value = '';
    amount.value = 1;
  } finally {
    adding.value = false;
  }
}

function stepItemAmount(item: ShoppingListItem, direction: -1 | 1) {
  const step = item.amount < 5 ? 0.5 : 1;
  const next = Math.max(0.25, Math.round((item.amount + direction * step) * 100) / 100);
  void shoppingStore.updateItem(item.id, { amount: next });
}

function openEditModal(item: ShoppingListItem) {
  editError.value = null;
  editingItem.value = item;
  editName.value = item.product_name;
  editAmount.value = String(item.amount).replace('.', ',');
  editUnit.value = item.unit || 'шт';
}

watch(editingItem, (item) => {
  if (item) {
    appStore.pushBackHandler('edit-shopping-item', closeEditModal);
  } else {
    appStore.removeBackHandler('edit-shopping-item');
  }
});

function closeEditModal() {
  appStore.removeBackHandler('edit-shopping-item');
  editError.value = null;
  editingItem.value = null;
}

const editBackdrop = useBackdropDismiss(closeEditModal);

function saveEditModal() {
  const item = editingItem.value;
  if (!item) return;

  const rawAmount = String(editAmount.value ?? '').replace(',', '.').trim();
  const parsedAmount = Number.parseFloat(rawAmount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    editError.value = 'Укажите количество больше 0';
    return;
  }

  editError.value = null;
  const cleanName = String(editName.value ?? '').trim() || item.product_name;
  const cleanUnit = String(editUnit.value ?? '').trim() || 'шт';

  void shoppingStore.updateItem(item.id, {
    product_name: cleanName,
    amount: parsedAmount,
    unit: cleanUnit,
  });
  closeEditModal();
  showToast('Пункт обновлён');
}

watch(shareModalOpen, (isOpen) => {
  if (isOpen) {
    shareMode.value = shoppingStore.uncheckedCount > 0 ? 'unchecked' : 'all';
    appStore.pushBackHandler('share-shopping-list', closeShareModal);
  } else {
    appStore.removeBackHandler('share-shopping-list');
  }
});

function closeShareModal() {
  appStore.removeBackHandler('share-shopping-list');
  shareModalOpen.value = false;
}

const shareBackdrop = useBackdropDismiss(closeShareModal);

onUnmounted(() => {
  appStore.removeBackHandler('clear-all-shopping-list');
  appStore.removeBackHandler('edit-shopping-item');
  appStore.removeBackHandler('share-shopping-list');
});

const itemsToShare = computed(() => {
  const list =
    shareMode.value === 'unchecked'
      ? shoppingStore.sortedItems.filter((i) => !i.is_checked)
      : shoppingStore.sortedItems;
  return list;
});

const formattedShareText = computed(() => {
  const lines = itemsToShare.value.map((item) => {
    const qty = `${formatAmount(item.amount)} ${item.unit}`.trim();
    const recipeNote = item.recipe_title ? ` (${item.recipe_title})` : '';
    const prefix = item.is_checked ? '✅' : '▫️';
    return `${prefix} ${item.product_name} — ${qty}${recipeNote}`;
  });
  return `🥟 Список покупок из «Пухни»:\n\n${lines.join('\n')}`;
});

async function copyShareTextFallback(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Список скопирован в буфер обмена');
  } catch {
    showToast('Не удалось открыть меню отправки');
  }
}

async function handleShareNow() {
  if (itemsToShare.value.length === 0) return;
  const text = formattedShareText.value;

  try {
    await Share.share({
      title: 'Список покупок — Пухня',
      text,
      dialogTitle: 'Отправить список покупок',
    });
    closeShareModal();
  } catch {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Список покупок — Пухня', text });
        closeShareModal();
        return;
      } catch {
        // Если пользователь отменил или Web Share недоступен — пробуем буфер
      }
    }
    await copyShareTextFallback(text);
    closeShareModal();
  }
}

async function handleCopyText() {
  if (itemsToShare.value.length === 0) return;
  await copyShareTextFallback(formattedShareText.value);
  closeShareModal();
}
</script>

<template>
  <div class="overflow-x-clip pb-28">
    <!-- Закреплённая шапка без разделительных рамок и линий -->
    <header class="sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),2rem)] backdrop-blur-xl sm:px-5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium uppercase tracking-wider text-accent">
            Общий список семьи
          </p>
          <h1 class="mt-0.5 truncate font-display text-2xl font-extrabold text-ink">
            Список покупок
          </h1>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <button
            v-if="shoppingStore.items.length > 0"
            type="button"
            class="tactile inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-organic-sm"
            @click="shareModalOpen = true"
          >
            <Share2 class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span>Поделиться</span>
          </button>

          <span
            v-if="recipesStore.isOffline"
            class="inline-flex items-center gap-1 rounded-full bg-warm/15 px-2.5 py-1.5 text-[11px] font-semibold text-warm"
          >
            <WifiOff class="h-3.5 w-3.5" aria-hidden="true" />
            <span class="hidden sm:inline">Офлайн</span>
          </span>
          <span
            v-else-if="shoppingStore.realtimeConnected"
            class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1.5 text-[11px] font-semibold text-accent"
          >
            <Radio class="h-3.5 w-3.5" aria-hidden="true" />
            <span>Live</span>
          </span>
        </div>
      </div>
    </header>

    <div class="px-4 pb-4 pt-3 sm:px-5">
      <!-- Быстрое добавление продукта (резиновая сетка для 320px+) -->
      <form
        class="organic-card space-y-2.5 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-sm"
        @submit.prevent="handleAdd"
      >
        <input
          v-model="productName"
          type="text"
          placeholder="Добавить продукт (например: Молоко)"
          aria-label="Название продукта"
          class="w-full min-w-0 rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
        />
        <div class="grid grid-cols-12 items-center gap-2">
          <input
            v-model.number="amount"
            type="number"
            min="0.01"
            step="any"
            inputmode="decimal"
            aria-label="Количество"
            class="col-span-3 min-w-0 rounded-2xl border border-hairline bg-canvas px-2.5 py-2 text-sm font-semibold text-ink tabular-nums focus:border-accent focus:outline-none"
          />
          <select
            v-model="unit"
            aria-label="Единица измерения"
            class="col-span-4 min-w-0 rounded-2xl border border-hairline bg-canvas px-2 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option v-for="u in INGREDIENT_UNITS" :key="u" :value="u">
              {{ u }}
            </option>
          </select>
          <button
            type="submit"
            :disabled="adding || !productName.trim()"
            class="tactile col-span-5 inline-flex min-w-0 items-center justify-center gap-1 rounded-2xl bg-accent px-3 py-2 text-xs font-semibold text-accent-contrast disabled:opacity-50"
          >
            <Plus class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span class="truncate">Добавить</span>
          </button>
        </div>
      </form>
    </div>

    <main class="px-4 sm:px-5">
      <div
        v-if="shoppingStore.items.length === 0"
        class="mt-4 flex flex-col items-center rounded-4xl border border-dashed border-hairline bg-surface/60 p-8 text-center"
      >
        <ShoppingBag class="mb-3 h-9 w-9 text-ink-tertiary" aria-hidden="true" />
        <p class="font-display text-base font-bold text-ink">Список покупок пуст</p>
        <p class="mt-1 text-xs text-ink-secondary">
          Добавляйте продукты вручную или прямо со страницы любого рецепта.
        </p>
      </div>

      <template v-else>
        <!-- Панель массовых действий -->
        <div class="mb-3 space-y-2 rounded-3xl border border-hairline bg-surface/80 p-3 shadow-organic-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-medium text-ink-secondary tabular-nums">
              Осталось купить: <strong class="font-bold text-ink">{{ shoppingStore.uncheckedCount }}</strong> из {{ shoppingStore.items.length }}
            </span>

            <button
              type="button"
              class="tactile inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
              @click="shoppingStore.toggleAllChecked()"
            >
              <CheckSquare v-if="shoppingStore.allChecked" class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <Square v-else class="h-3.5 w-3.5 text-ink-secondary" aria-hidden="true" />
              <span>{{ shoppingStore.allChecked ? 'Снять отметки' : 'Отметить все' }}</span>
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="shoppingStore.checkedCount > 0"
              type="button"
              class="tactile inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
              @click="shoppingStore.clearChecked()"
            >
              <Trash2 class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="truncate">Удалить купленные ({{ shoppingStore.checkedCount }})</span>
            </button>

            <button
              type="button"
              class="tactile inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink-secondary hover:border-danger/40 hover:text-danger"
              :class="{ 'flex-1': shoppingStore.checkedCount === 0 }"
              @click="clearAllModalOpen = true"
            >
              <Trash2 class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Очистить всё</span>
            </button>
          </div>
        </div>

        <ul class="space-y-2.5">
          <li
            v-for="item in shoppingStore.sortedItems"
            :key="item.id"
            class="organic-card flex flex-col gap-2 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-sm transition-opacity"
            :class="{ 'opacity-60': item.is_checked }"
          >
            <!-- Верхняя строка: чекбокс + название + удаление -->
            <div class="flex items-start justify-between gap-2.5">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-start gap-3 text-left"
                @click="shoppingStore.toggleItem(item.id)"
              >
                <span
                  class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border transition-colors"
                  :class="
                    item.is_checked
                      ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-canvas'
                  "
                >
                  <Check v-if="item.is_checked" class="h-4 w-4" aria-hidden="true" />
                </span>

                <div class="min-w-0 flex-1">
                  <p
                    class="break-words text-sm font-semibold leading-snug"
                    :class="item.is_checked ? 'text-ink-tertiary line-through' : 'text-ink'"
                  >
                    {{ item.product_name }}
                  </p>
                  <p v-if="item.recipe_title" class="mt-0.5 truncate text-[11px] text-ink-tertiary">
                    из: {{ item.recipe_title }}
                  </p>
                </div>
              </button>

              <button
                type="button"
                aria-label="Удалить из списка"
                class="tactile shrink-0 rounded-xl p-1.5 text-ink-tertiary hover:text-danger"
                @click="shoppingStore.deleteItem(item.id)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <!-- Нижняя строка: быстрое изменение -/+ и кликабельный бейдж редактирования -->
            <div class="flex items-center justify-between gap-2 pl-9">
              <div class="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted p-0.5">
                <button
                  type="button"
                  aria-label="Уменьшить количество"
                  class="tactile flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink shadow-organic-sm"
                  @click="stepItemAmount(item, -1)"
                >
                  <Minus class="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  title="Нажмите для редактирования"
                  class="tactile inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-accent tabular-nums"
                  @click="openEditModal(item)"
                >
                  <span>{{ formatAmount(item.amount) }} {{ item.unit }}</span>
                  <Pencil class="h-3 w-3 opacity-60" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  aria-label="Увеличить количество"
                  class="tactile flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink shadow-organic-sm"
                  @click="stepItemAmount(item, 1)"
                >
                  <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </main>

    <!-- Модалка редактирования пункта -->
    <Teleport to="body">
      <div
        v-if="Boolean(editingItem)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-item-title"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pt-[max(20dvh,calc(env(safe-area-inset-top)+3rem))] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6"
        @pointerdown="editBackdrop.onBackdropPointerDown"
        @pointerup="editBackdrop.onBackdropPointerUp"
        @pointercancel="editBackdrop.onBackdropPointerCancel"
      >
        <div
          class="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-organic-lg sm:rounded-3xl"
          @pointerdown.stop
          @pointerup.stop
          @click.stop
        >
          <div class="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-5 py-4">
            <h3 id="edit-item-title" class="font-display text-base font-bold text-ink">
              Изменить пункт
            </h3>
            <button
              type="button"
              aria-label="Закрыть"
              class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
              @click="closeEditModal"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <form
            novalidate
            class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            @submit.prevent="saveEditModal"
          >
            <div>
              <label class="mb-1 block text-xs font-semibold text-ink">Название</label>
              <input
                v-model="editName"
                type="text"
                class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                @keyup.enter="saveEditModal"
              />
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="mb-1 block text-xs font-semibold text-ink">Количество</label>
                <input
                  v-model="editAmount"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="w-full rounded-2xl border bg-canvas px-3.5 py-2.5 text-sm font-bold text-ink tabular-nums focus:border-accent focus:outline-none"
                  :class="editError ? 'border-danger' : 'border-hairline'"
                  @input="editError = null"
                  @keyup.enter="saveEditModal"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-ink">Единица</label>
                <select
                  v-model="editUnit"
                  class="w-full rounded-2xl border border-hairline bg-canvas px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option v-for="u in INGREDIENT_UNITS" :key="u" :value="u">
                    {{ u }}
                  </option>
                </select>
              </div>
            </div>

            <p v-if="editError" role="alert" class="text-xs font-medium text-danger">
              {{ editError }}
            </p>

            <div class="flex gap-2 pt-2">
              <button
                type="button"
                class="tactile flex-1 rounded-2xl border border-hairline bg-canvas py-2.5 text-xs font-semibold text-ink-secondary"
                @click.stop="closeEditModal"
              >
                Отмена
              </button>
              <button
                type="button"
                class="tactile flex-1 rounded-2xl bg-accent py-2.5 text-xs font-semibold text-accent-contrast shadow-organic-sm"
                @pointerdown.stop.prevent="saveEditModal"
                @click.stop.prevent="saveEditModal"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Модалка подтверждения полной очистки списка -->
    <Teleport to="body">
      <div
        v-if="clearAllModalOpen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-all-title"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pt-[max(20dvh,calc(env(safe-area-inset-top)+3rem))] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6"
        @pointerdown="clearAllBackdrop.onBackdropPointerDown"
        @pointerup="clearAllBackdrop.onBackdropPointerUp"
        @pointercancel="clearAllBackdrop.onBackdropPointerCancel"
      >
        <div
          class="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-organic-lg sm:rounded-3xl"
          @pointerdown.stop
          @pointerup.stop
          @click.stop
        >
          <div class="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div class="flex min-w-0 items-center gap-2.5">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                <AlertTriangle class="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 id="clear-all-title" class="truncate font-display text-base font-bold text-ink">
                Очистить весь список?
              </h3>
            </div>
            <button
              type="button"
              aria-label="Закрыть"
              class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
              @click="closeClearAllModal"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p class="text-xs leading-relaxed text-ink-secondary">
              Все продукты ({{ shoppingStore.items.length }}) будут удалены из общего семейного списка покупок.
            </p>

            <div class="mt-4 flex gap-2">
              <button
                type="button"
                class="tactile flex-1 rounded-2xl border border-hairline bg-canvas py-2.5 text-xs font-semibold text-ink"
                @click="closeClearAllModal"
              >
                Отмена
              </button>
              <button
                type="button"
                class="tactile flex-1 rounded-2xl bg-danger py-2.5 text-xs font-semibold text-white shadow-organic-sm"
                @click="confirmClearAll"
              >
                Очистить всё
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Модалка «Поделиться списком покупок» -->
    <Teleport to="body">
      <div
        v-if="shareModalOpen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-list-title"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pt-[max(20dvh,calc(env(safe-area-inset-top)+3rem))] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6"
        @pointerdown="shareBackdrop.onBackdropPointerDown"
        @pointerup="shareBackdrop.onBackdropPointerUp"
        @pointercancel="shareBackdrop.onBackdropPointerCancel"
      >
        <div
          class="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-organic-lg sm:rounded-3xl"
          @pointerdown.stop
          @pointerup.stop
          @click.stop
        >
          <div class="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-5 py-4">
            <h3 id="share-list-title" class="font-display text-base font-bold text-ink">
              Поделиться списком
            </h3>
            <button
              type="button"
              aria-label="Закрыть"
              class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
              @click="closeShareModal"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="tactile rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors"
                :class="
                  shareMode === 'unchecked'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-hairline bg-canvas text-ink-secondary'
                "
                @click="shareMode = 'unchecked'"
              >
                Некупленное ({{ shoppingStore.uncheckedCount }})
              </button>
              <button
                type="button"
                class="tactile rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors"
                :class="
                  shareMode === 'all'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-hairline bg-canvas text-ink-secondary'
                "
                @click="shareMode = 'all'"
              >
                Весь список ({{ shoppingStore.items.length }})
              </button>
            </div>

            <div
              v-if="itemsToShare.length === 0"
              class="mt-3 rounded-2xl border border-dashed border-hairline p-4 text-center text-xs text-ink-secondary"
            >
              В выбранном варианте нет продуктов. Переключитесь на «Весь список».
            </div>

            <pre
              v-else
              class="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-canvas p-3 font-sans text-xs leading-relaxed text-ink-secondary"
            >{{ formattedShareText }}</pre>

            <div class="mt-4 flex flex-col gap-2">
              <button
                type="button"
                :disabled="itemsToShare.length === 0"
                class="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-semibold text-accent-contrast shadow-organic-sm disabled:opacity-50"
                @click="handleShareNow"
              >
                <Share2 class="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Отправить в мессенджер</span>
              </button>

              <button
                type="button"
                :disabled="itemsToShare.length === 0"
                class="tactile flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas px-4 py-2.5 text-xs font-semibold text-ink disabled:opacity-50"
                @click="handleCopyText"
              >
                <Copy class="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Скопировать текст</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

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
