<script setup lang="ts">
import { ref } from 'vue';
import {
  Check,
  Plus,
  Radio,
  ShoppingBag,
  Trash2,
  WifiOff,
} from 'lucide-vue-next';
import { formatAmount, INGREDIENT_UNITS } from '@cookbook/shared';
import { useShoppingListStore } from '@/stores/shoppingList';
import { useMobileRecipesStore } from '@/stores/recipes';

const shoppingStore = useShoppingListStore();
const recipesStore = useMobileRecipesStore();

const productName = ref('');
const amount = ref<number>(1);
const unit = ref<string>('шт');
const adding = ref(false);

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
</script>

<template>
  <div class="pb-28">
    <header class="px-5 pb-4 pt-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-accent">
            Общий список семьи
          </p>
          <h1 class="mt-0.5 font-display text-2xl font-extrabold text-ink">
            Список покупок
          </h1>
        </div>

        <span
          v-if="recipesStore.isOffline"
          class="inline-flex items-center gap-1 rounded-full bg-warm/15 px-3 py-1.5 text-[11px] font-semibold text-warm"
        >
          <WifiOff class="h-3.5 w-3.5" aria-hidden="true" />
          Офлайн
        </span>
        <span
          v-else-if="shoppingStore.realtimeConnected"
          class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[11px] font-semibold text-accent"
        >
          <Radio class="h-3.5 w-3.5" aria-hidden="true" />
          Live
        </span>
      </div>

      <!-- Быстрое добавление продукта -->
      <form
        class="organic-card mt-4 space-y-2.5 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-sm"
        @submit.prevent="handleAdd"
      >
        <input
          v-model="productName"
          type="text"
          placeholder="Добавить продукт (например: Молоко)"
          aria-label="Название продукта"
          class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
        />
        <div class="flex items-center gap-2">
          <input
            v-model.number="amount"
            type="number"
            min="0.01"
            step="any"
            inputmode="decimal"
            aria-label="Количество"
            class="w-24 rounded-2xl border border-hairline bg-canvas px-3 py-2 text-sm font-semibold text-ink tabular-nums focus:border-accent focus:outline-none"
          />
          <select
            v-model="unit"
            aria-label="Единица измерения"
            class="flex-1 rounded-2xl border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option v-for="u in INGREDIENT_UNITS" :key="u" :value="u">
              {{ u }}
            </option>
          </select>
          <button
            type="submit"
            :disabled="adding || !productName.trim()"
            class="tactile inline-flex items-center gap-1 rounded-2xl bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast disabled:opacity-50"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            <span>Добавить</span>
          </button>
        </div>
      </form>
    </header>

    <main class="px-5">
      <div v-if="shoppingStore.items.length === 0" class="mt-4 flex flex-col items-center rounded-4xl border border-dashed border-hairline bg-surface/60 p-8 text-center">
        <ShoppingBag class="mb-3 h-9 w-9 text-ink-tertiary" aria-hidden="true" />
        <p class="font-display text-base font-bold text-ink">Список покупок пуст</p>
        <p class="mt-1 text-xs text-ink-secondary">
          Добавляйте продукты вручную или прямо со страницы любого рецепта.
        </p>
      </div>

      <template v-else>
        <div class="mb-3 flex items-center justify-between">
          <span class="text-xs font-medium text-ink-secondary tabular-nums">
            Осталось купить: {{ shoppingStore.uncheckedCount }}
          </span>
          <button
            v-if="shoppingStore.items.some((i) => i.is_checked)"
            type="button"
            class="tactile text-xs font-semibold text-danger"
            @click="shoppingStore.clearChecked()"
          >
            Удалить купленное
          </button>
        </div>

        <ul class="space-y-2.5">
          <li
            v-for="item in shoppingStore.sortedItems"
            :key="item.id"
            class="organic-card flex items-center justify-between gap-3 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-sm transition-opacity"
            :class="{ 'opacity-60': item.is_checked }"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              @click="shoppingStore.toggleItem(item.id)"
            >
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border transition-colors"
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
                  class="truncate text-sm font-semibold"
                  :class="item.is_checked ? 'text-ink-tertiary line-through' : 'text-ink'"
                >
                  {{ item.product_name }}
                </p>
                <p v-if="item.recipe_title" class="truncate text-[11px] text-ink-tertiary">
                  из: {{ item.recipe_title }}
                </p>
              </div>
            </button>

            <div class="flex shrink-0 items-center gap-2">
              <span class="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent tabular-nums">
                {{ formatAmount(item.amount) }} {{ item.unit }}
              </span>
              <button
                type="button"
                aria-label="Удалить из списка"
                class="tactile rounded-xl p-1.5 text-ink-tertiary hover:text-danger"
                @click="shoppingStore.deleteItem(item.id)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ul>
      </template>
    </main>
  </div>
</template>
