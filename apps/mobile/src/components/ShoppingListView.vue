<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Share } from '@capacitor/share';
import {
  Check,
  CheckCircle2,
  Copy,
  Minus,
  Pencil,
  Plus,
  Radio,
  Share2,
  ShoppingBag,
  Trash2,
  WifiOff,
  X,
} from 'lucide-vue-next';
import { formatAmount, INGREDIENT_UNITS, type ShoppingListItem } from '@cookbook/shared';
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
const shareDialogRef = ref<HTMLDialogElement | null>(null);
const shareMode = ref<'unchecked' | 'all'>('unchecked');

// Состояние модалки редактирования пункта
const editingItem = ref<ShoppingListItem | null>(null);
const editDialogRef = ref<HTMLDialogElement | null>(null);
const editName = ref('');
const editAmount = ref<string>('1');
const editUnit = ref('шт');

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
  editingItem.value = item;
  editName.value = item.product_name;
  editAmount.value = String(item.amount);
  editUnit.value = item.unit || 'шт';
}

watch(editingItem, (item) => {
  const dialog = editDialogRef.value;
  if (!dialog) return;
  if (item) {
    if (!dialog.open) dialog.showModal();
    appStore.pushBackHandler('edit-shopping-item', () => {
      editDialogRef.value?.close();
    });
  } else {
    appStore.removeBackHandler('edit-shopping-item');
    if (dialog.open) dialog.close();
  }
});

function closeEditModal() {
  appStore.removeBackHandler('edit-shopping-item');
  editingItem.value = null;
}

function saveEditModal() {
  if (!editingItem.value) return;
  const parsedAmount = Number.parseFloat(editAmount.value.replace(',', '.'));
  void shoppingStore.updateItem(editingItem.value.id, {
    product_name: editName.value.trim() || editingItem.value.product_name,
    amount: !Number.isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : editingItem.value.amount,
    unit: editUnit.value,
  });
  editDialogRef.value?.close();
}

watch(shareModalOpen, (isOpen) => {
  const dialog = shareDialogRef.value;
  if (!dialog) return;
  if (isOpen) {
    shareMode.value = shoppingStore.uncheckedCount > 0 ? 'unchecked' : 'all';
    if (!dialog.open) dialog.showModal();
    appStore.pushBackHandler('share-shopping-list', () => {
      shareDialogRef.value?.close();
    });
  } else {
    appStore.removeBackHandler('share-shopping-list');
    if (dialog.open) dialog.close();
  }
});

function closeShareModal() {
  appStore.removeBackHandler('share-shopping-list');
  shareModalOpen.value = false;
}

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
    shareDialogRef.value?.close();
  } catch {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Список покупок — Пухня', text });
        shareDialogRef.value?.close();
        return;
      } catch {
        // Если пользователь отменил или Web Share недоступен — пробуем буфер
      }
    }
    await copyShareTextFallback(text);
    shareDialogRef.value?.close();
  }
}

async function handleCopyText() {
  if (itemsToShare.value.length === 0) return;
  await copyShareTextFallback(formattedShareText.value);
  shareDialogRef.value?.close();
}
</script>

<template>
  <div class="overflow-x-clip pb-28">
    <header class="px-4 pb-4 pt-5 sm:px-5">
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

      <!-- Быстрое добавление продукта (резиновая сетка для 320px+) -->
      <form
        class="organic-card mt-4 space-y-2.5 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-sm"
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
    </header>

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
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-medium text-ink-secondary tabular-nums">
            Осталось купить: {{ shoppingStore.uncheckedCount }}
          </span>
          <button
            v-if="shoppingStore.items.some((i) => i.is_checked)"
            type="button"
            class="tactile shrink-0 text-xs font-semibold text-danger"
            @click="shoppingStore.clearChecked()"
          >
            Удалить купленное
          </button>
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

    <!-- Модалка редактирования продукта -->
    <dialog
      ref="editDialogRef"
      aria-labelledby="edit-item-title"
      class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-4xl border border-hairline bg-surface p-5 text-ink shadow-organic-lg"
      @close="closeEditModal"
    >
      <div class="flex items-center justify-between gap-2">
        <h3 id="edit-item-title" class="font-display text-base font-bold text-ink">
          Изменить пункт
        </h3>
        <button
          type="button"
          aria-label="Закрыть"
          class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
          @click="editDialogRef?.close()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form class="mt-4 space-y-3" @submit.prevent="saveEditModal">
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink">Название</label>
          <input
            v-model="editName"
            type="text"
            required
            class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="mb-1 block text-xs font-semibold text-ink">Количество</label>
            <input
              v-model="editAmount"
              type="number"
              min="0.01"
              step="any"
              inputmode="decimal"
              required
              class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm font-bold text-ink tabular-nums focus:border-accent focus:outline-none"
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

        <div class="flex gap-2 pt-2">
          <button
            type="button"
            class="tactile flex-1 rounded-2xl border border-hairline bg-canvas py-2.5 text-xs font-semibold text-ink-secondary"
            @click="editDialogRef?.close()"
          >
            Отмена
          </button>
          <button
            type="submit"
            class="tactile flex-1 rounded-2xl bg-accent py-2.5 text-xs font-semibold text-accent-contrast shadow-organic-sm"
          >
            Сохранить
          </button>
        </div>
      </form>
    </dialog>

    <!-- Модалка «Поделиться списком покупок» -->
    <dialog
      ref="shareDialogRef"
      aria-labelledby="share-list-title"
      class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-4xl border border-hairline bg-surface p-5 text-ink shadow-organic-lg"
      @close="closeShareModal"
    >
      <div class="flex items-center justify-between gap-2">
        <h3 id="share-list-title" class="font-display text-base font-bold text-ink">
          Поделиться списком
        </h3>
        <button
          type="button"
          aria-label="Закрыть"
          class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
          @click="shareDialogRef?.close()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
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
