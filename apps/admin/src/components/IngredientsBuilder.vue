<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-vue-next';
import { INGREDIENT_UNITS } from '@cookbook/shared';
import type { IngredientDraft } from '@/stores/recipes';

const ingredients = defineModel<IngredientDraft[]>({ required: true });

function addRow() {
  ingredients.value.push({
    localId: crypto.randomUUID(),
    name: '',
    amount: null,
    unit: 'г',
    is_scalable: true,
  });
}

function removeRow(index: number) {
  ingredients.value.splice(index, 1);
}

function moveRow(index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= ingredients.value.length) return;
  const copy = [...ingredients.value];
  const [moved] = copy.splice(index, 1);
  copy.splice(targetIndex, 0, moved);
  ingredients.value = copy;
}

function updateAmount(item: IngredientDraft, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (raw === '') {
    item.amount = null;
    return;
  }
  const num = Number(raw);
  item.amount = Number.isNaN(num) ? null : num;
}
</script>

<template>
  <section class="organic-card rounded-3xl border border-hairline bg-surface p-5 shadow-organic-sm">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-display text-base font-bold text-ink">Ингредиенты</h3>
        <p class="text-xs text-ink-secondary">
          Отметьте «Не масштабировать» для соли, перца и специй по вкусу.
        </p>
      </div>
      <button
        type="button"
        class="tactile inline-flex items-center gap-1.5 rounded-2xl bg-accent-soft px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-contrast"
        @click="addRow"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        <span>Добавить ингредиент</span>
      </button>
    </div>

    <div v-if="ingredients.length === 0" class="rounded-2xl border border-dashed border-hairline p-6 text-center text-xs text-ink-secondary">
      Список пуст. Добавьте первый ингредиент.
    </div>

    <div v-else class="space-y-2.5">
      <div
        v-for="(item, index) in ingredients"
        :key="item.localId"
        class="grid grid-cols-12 items-center gap-2 rounded-2xl border border-hairline bg-canvas/55 p-2.5"
      >
        <!-- Кнопки сортировки -->
        <div class="col-span-2 flex items-center gap-0.5 sm:col-span-1">
          <button
            type="button"
            :disabled="index === 0"
            aria-label="Переместить вверх"
            class="tactile rounded-lg p-1 text-ink-secondary hover:bg-surface disabled:opacity-30"
            @click="moveRow(index, -1)"
          >
            <ArrowUp class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            :disabled="index === ingredients.length - 1"
            aria-label="Переместить вниз"
            class="tactile rounded-lg p-1 text-ink-secondary hover:bg-surface disabled:opacity-30"
            @click="moveRow(index, 1)"
          >
            <ArrowDown class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <!-- Название продукта -->
        <div class="col-span-10 sm:col-span-4">
          <input
            v-model="item.name"
            type="text"
            placeholder="Например: Куриное филе"
            :aria-label="`Название ингредиента ${index + 1}`"
            class="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          />
        </div>

        <!-- Количество -->
        <div class="col-span-5 sm:col-span-2">
          <input
            :value="item.amount ?? ''"
            type="number"
            min="0"
            step="any"
            placeholder="Кол-во"
            :aria-label="`Количество ингредиента ${index + 1}`"
            class="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink tabular-nums placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
            @input="updateAmount(item, $event)"
          />
        </div>

        <!-- Единица измерения -->
        <div class="col-span-4 sm:col-span-2">
          <select
            v-model="item.unit"
            :aria-label="`Единица измерения ${index + 1}`"
            class="w-full rounded-xl border border-hairline bg-surface px-2.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option v-for="u in INGREDIENT_UNITS" :key="u" :value="u">
              {{ u }}
            </option>
          </select>
        </div>

        <!-- Чекбокс "Не масштабировать" -->
        <div class="col-span-9 flex items-center sm:col-span-2">
          <label class="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-secondary select-none">
            <input
              type="checkbox"
              :checked="!item.is_scalable"
              class="h-4 w-4 rounded border-hairline"
              @change="item.is_scalable = !($event.target as HTMLInputElement).checked"
            />
            <span>Не масштаб.</span>
          </label>
        </div>

        <!-- Удалить строку -->
        <div class="col-span-3 flex justify-end sm:col-span-1">
          <button
            type="button"
            aria-label="Удалить ингредиент"
            class="tactile rounded-xl p-2 text-ink-tertiary hover:bg-danger/10 hover:text-danger"
            @click="removeRow(index)"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
