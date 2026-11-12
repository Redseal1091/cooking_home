<script setup lang="ts">
import { computed } from 'vue';
import { Flame, Scale, Timer, Users } from 'lucide-vue-next';
import { calculateNutritionPerServing } from '@cookbook/shared';

const prepTimeMin = defineModel<number>('prepTimeMin', { required: true });
const cookTimeMin = defineModel<number>('cookTimeMin', { required: true });
const baseServings = defineModel<number>('baseServings', { required: true });
const totalWeightG = defineModel<number | null>('totalWeightG', { required: true });
const calories = defineModel<number | null>('calories', { required: true });
const proteins = defineModel<number | null>('proteins', { required: true });
const fats = defineModel<number | null>('fats', { required: true });
const carbs = defineModel<number | null>('carbs', { required: true });

const perServing = computed(() =>
  calculateNutritionPerServing({
    base_servings: baseServings.value || 1,
    total_weight_g: totalWeightG.value,
    calories: calories.value,
    proteins: proteins.value,
    fats: fats.value,
    carbs: carbs.value,
  }),
);

function parseNullableNumber(e: Event): number | null {
  const val = (e.target as HTMLInputElement).value;
  if (val === '') return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
}
</script>

<template>
  <section class="organic-card rounded-3xl border border-hairline bg-surface p-5 shadow-organic-sm">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-display text-base font-bold text-ink">Время, порции и КБЖУ</h3>
        <p class="text-xs text-ink-secondary">
          Указывайте суммарные КБЖУ на весь рецепт — приложение пересчитает их на 1 порцию.
        </p>
      </div>

      <div
        v-if="perServing.calories !== null"
        class="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-medium text-accent tabular-nums"
      >
        <Flame class="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          На 1 порцию: <strong>{{ perServing.calories }} ккал</strong>
          <template v-if="perServing.proteins !== null || perServing.fats !== null || perServing.carbs !== null">
            · Б {{ perServing.proteins ?? 0 }} / Ж {{ perServing.fats ?? 0 }} / У {{ perServing.carbs ?? 0 }}
          </template>
        </span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <label for="prep-time" class="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <Timer class="h-3.5 w-3.5" aria-hidden="true" />
          Подготовка (мин)
        </label>
        <input
          id="prep-time"
          v-model.number="prepTimeMin"
          type="number"
          min="0"
          step="1"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label for="cook-time" class="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <Timer class="h-3.5 w-3.5" aria-hidden="true" />
          Готовка (мин)
        </label>
        <input
          id="cook-time"
          v-model.number="cookTimeMin"
          type="number"
          min="0"
          step="1"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label for="base-servings" class="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <Users class="h-3.5 w-3.5" aria-hidden="true" />
          Базовых порций
        </label>
        <input
          id="base-servings"
          v-model.number="baseServings"
          type="number"
          min="1"
          step="1"
          required
          class="organic-input w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label for="total-weight" class="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <Scale class="h-3.5 w-3.5" aria-hidden="true" />
          Общий вес (г)
        </label>
        <input
          id="total-weight"
          :value="totalWeightG ?? ''"
          type="number"
          min="1"
          step="1"
          placeholder="Опционально"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          @input="totalWeightG = parseNullableNumber($event)"
        />
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <label for="kcal" class="mb-1 block text-xs font-medium text-ink-secondary">
          Калории (всего)
        </label>
        <input
          id="kcal"
          :value="calories ?? ''"
          type="number"
          min="0"
          step="0.1"
          placeholder="ккал"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          @input="calories = parseNullableNumber($event)"
        />
      </div>

      <div>
        <label for="proteins" class="mb-1 block text-xs font-medium text-ink-secondary">
          Белки (г)
        </label>
        <input
          id="proteins"
          :value="proteins ?? ''"
          type="number"
          min="0"
          step="0.1"
          placeholder="г"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          @input="proteins = parseNullableNumber($event)"
        />
      </div>

      <div>
        <label for="fats" class="mb-1 block text-xs font-medium text-ink-secondary">
          Жиры (г)
        </label>
        <input
          id="fats"
          :value="fats ?? ''"
          type="number"
          min="0"
          step="0.1"
          placeholder="г"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          @input="fats = parseNullableNumber($event)"
        />
      </div>

      <div>
        <label for="carbs" class="mb-1 block text-xs font-medium text-ink-secondary">
          Углеводы (г)
        </label>
        <input
          id="carbs"
          :value="carbs ?? ''"
          type="number"
          min="0"
          step="0.1"
          placeholder="г"
          class="w-full rounded-2xl border border-hairline bg-canvas/70 px-3.5 py-2.5 text-sm text-ink tabular-nums placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          @input="carbs = parseNullableNumber($event)"
        />
      </div>
    </div>
  </section>
</template>
