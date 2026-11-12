<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowDown, ArrowUp, FolderPlus, Layers, Plus, Trash2, X } from 'lucide-vue-next';
import { DEFAULT_INGREDIENT_SECTIONS, INGREDIENT_UNITS, normalizeIngredient } from '@cookbook/shared';
import type { IngredientDraft } from '@/stores/recipes';

const ingredients = defineModel<IngredientDraft[]>({ required: true });

const showSectionCreator = ref(false);
const newSectionName = ref('');
const lastActiveSection = ref<string | null>(null);

const sectionSuggestions = computed(() => {
  const existing = ingredients.value
    .map((i) => i.section_name?.trim() || '')
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_INGREDIENT_SECTIONS, ...existing]));
});

function addRow(sectionName: string | null = lastActiveSection.value) {
  ingredients.value.push({
    localId: crypto.randomUUID(),
    name: '',
    amount: null,
    unit: 'г',
    is_scalable: true,
    section_name: sectionName?.trim() || null,
  });
}

function createSectionAndRow(preset?: string) {
  const name = (preset ?? newSectionName.value).trim();
  if (!name) return;
  lastActiveSection.value = name;
  addRow(name);
  if (!preset) newSectionName.value = '';
  showSectionCreator.value = false;
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

function updateSection(item: IngredientDraft, event: Event) {
  const val = (event.target as HTMLInputElement).value.trim();
  item.section_name = val || null;
  if (val) lastActiveSection.value = val;
}

function normalizeRowName(item: IngredientDraft) {
  const normalized = normalizeIngredient(item.name, item.section_name);
  item.name = normalized.name;
  item.section_name = normalized.section_name;
  if (normalized.section_name) {
    lastActiveSection.value = normalized.section_name;
  }
}

function shouldShowSectionHeader(index: number): boolean {
  const current = ingredients.value[index]?.section_name?.trim() || null;
  if (!current) return false;
  if (index === 0) return true;
  const prev = ingredients.value[index - 1]?.section_name?.trim() || null;
  return current !== prev;
}
</script>

<template>
  <section class="organic-card rounded-3xl border border-hairline bg-surface p-5 shadow-organic-sm">
    <datalist id="admin-ingredient-sections">
      <option v-for="sec in sectionSuggestions" :key="sec" :value="sec" />
    </datalist>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-display text-base font-bold text-ink">Ингредиенты</h3>
        <p class="text-xs text-ink-secondary">
          Можно группировать по секциям («Для теста», «Для начинки») и отмечать специи как «Не масштабировать».
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="tactile inline-flex items-center gap-1.5 rounded-2xl border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-ink hover:bg-surface-muted"
          @click="showSectionCreator = !showSectionCreator"
        >
          <FolderPlus class="h-4 w-4 text-accent" aria-hidden="true" />
          <span>+ Группа / секция</span>
        </button>

        <button
          type="button"
          class="tactile inline-flex items-center gap-1.5 rounded-2xl bg-accent-soft px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-contrast"
          @click="addRow(null)"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span>Добавить ингредиент</span>
        </button>
      </div>
    </div>

    <!-- Панель быстрого добавления секции -->
    <div
      v-if="showSectionCreator"
      class="mb-4 rounded-2xl border border-accent/25 bg-accent-soft/40 p-3.5"
    >
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-semibold text-ink">Новая секция ингредиентов</span>
        <button
          type="button"
          aria-label="Закрыть панель секции"
          class="rounded-lg p-1 text-ink-tertiary hover:text-ink"
          @click="showSectionCreator = false"
        >
          <X class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <form class="flex flex-wrap gap-2" @submit.prevent="createSectionAndRow()">
        <input
          v-model="newSectionName"
          type="text"
          placeholder="Например: Для теста или Для крема..."
          class="min-w-[200px] flex-1 rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          :disabled="!newSectionName.trim()"
          class="tactile rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast disabled:opacity-50"
        >
          Создать и добавить строку
        </button>
      </form>

      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <button
          v-for="preset in DEFAULT_INGREDIENT_SECTIONS"
          :key="preset"
          type="button"
          class="tactile rounded-full border border-hairline bg-surface px-3 py-1 text-[11px] font-medium text-ink-secondary hover:border-accent hover:text-accent"
          @click="createSectionAndRow(preset)"
        >
          + {{ preset }}
        </button>
      </div>
    </div>

    <div
      v-if="ingredients.length === 0"
      class="rounded-2xl border border-dashed border-hairline p-6 text-center text-xs text-ink-secondary"
    >
      Список пуст. Добавьте первый ингредиент или группу.
    </div>

    <div v-else class="space-y-2.5">
      <template v-for="(item, index) in ingredients" :key="item.localId">
        <!-- Заголовок секции перед первой строкой группы -->
        <div
          v-if="shouldShowSectionHeader(index)"
          class="flex items-center justify-between gap-2 pt-2 first:pt-0"
        >
          <span class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
            <Layers class="h-3.5 w-3.5" aria-hidden="true" />
            {{ item.section_name }}
          </span>
          <button
            type="button"
            class="tactile text-[11px] font-semibold text-accent hover:underline"
            @click="addRow(item.section_name)"
          >
            + Ещё в «{{ item.section_name }}»
          </button>
        </div>

        <div
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
          <div class="col-span-10 sm:col-span-3">
            <input
              v-model="item.name"
              type="text"
              placeholder="Например: Куриное филе"
              :aria-label="`Название ингредиента ${index + 1}`"
              class="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              @blur="normalizeRowName(item)"
            />
          </div>

          <!-- Секция / группа -->
          <div class="col-span-12 sm:col-span-2">
            <input
              :value="item.section_name ?? ''"
              list="admin-ingredient-sections"
              type="text"
              placeholder="Секция (опц.)"
              :aria-label="`Секция ингредиента ${index + 1}`"
              class="w-full rounded-xl border border-hairline bg-surface px-2.5 py-2 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              @input="updateSection(item, $event)"
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

          <!-- Чекбокс "Не масштабировать" + Удалить -->
          <div class="col-span-3 flex items-center justify-end gap-1 sm:col-span-2">
            <label
              title="Не масштабировать (специи, соль)"
              class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-secondary select-none"
            >
              <input
                type="checkbox"
                :checked="!item.is_scalable"
                class="h-4 w-4 rounded border-hairline"
                @change="item.is_scalable = !($event.target as HTMLInputElement).checked"
              />
              <span class="hidden md:inline">Фикс.</span>
            </label>

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
      </template>
    </div>
  </section>
</template>
