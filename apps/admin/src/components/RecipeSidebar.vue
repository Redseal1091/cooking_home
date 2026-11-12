<script setup lang="ts">
import { computed, ref } from 'vue';
import { Clock, Plus, Search, UtensilsCrossed } from 'lucide-vue-next';
import type { Recipe } from '@cookbook/shared';

const props = defineProps<{
  recipes: Recipe[];
  selectedId?: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
}>();

const searchQuery = ref('');

const filteredRecipes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.recipes;
  return props.recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q),
  );
});
</script>

<template>
  <aside
    class="organic-card flex h-full flex-col rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="font-display text-lg font-bold text-ink">
        Рецепты
        <span class="ml-1 text-sm font-normal text-ink-tertiary tabular-nums">
          ({{ recipes.length }})
        </span>
      </h2>
      <button
        type="button"
        class="tactile inline-flex items-center gap-1.5 rounded-2xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-contrast shadow-organic-sm hover:bg-accent-hover"
        @click="emit('create')"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        <span>Новый</span>
      </button>
    </div>

    <div class="relative mb-3">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
        aria-hidden="true"
      />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Поиск по названию или категории..."
        aria-label="Поиск рецептов"
        class="w-full rounded-2xl border border-hairline bg-canvas/80 py-2.5 pl-9 pr-3 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
      />
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center py-10 text-xs text-ink-secondary">
      Загрузка рецептов...
    </div>

    <div
      v-else-if="filteredRecipes.length === 0"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-hairline p-6 text-center"
    >
      <UtensilsCrossed class="mb-2 h-7 w-7 text-ink-tertiary" aria-hidden="true" />
      <p class="text-sm font-medium text-ink">Пока нет рецептов</p>
      <p class="mt-1 text-xs text-ink-secondary">
        Нажмите «Новый», чтобы добавить первый семейный рецепт.
      </p>
    </div>

    <ul v-else class="flex-1 space-y-2 overflow-y-auto pr-1">
      <li v-for="recipe in filteredRecipes" :key="recipe.id">
        <button
          type="button"
          class="tactile flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all"
          :class="
            selectedId === recipe.id
              ? 'border-accent bg-accent-soft/70 shadow-organic-sm'
              : 'border-transparent bg-canvas/50 hover:border-hairline hover:bg-surface-muted/60'
          "
          @click="emit('select', recipe.id)"
        >
          <div class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-surface-muted">
            <img
              v-if="recipe.cover_url"
              :src="recipe.cover_url"
              :alt="recipe.title"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex h-full w-full items-center justify-center text-ink-tertiary">
              <UtensilsCrossed class="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate font-display text-sm font-bold text-ink">
              {{ recipe.title }}
            </p>
            <div class="mt-1 flex items-center gap-2 text-[11px] text-ink-secondary">
              <span class="truncate rounded-full bg-surface px-2 py-0.5 font-medium">
                {{ recipe.category }}
              </span>
              <span class="inline-flex shrink-0 items-center gap-1 tabular-nums">
                <Clock class="h-3 w-3" aria-hidden="true" />
                {{ recipe.prep_time_min + recipe.cook_time_min }} мин
              </span>
            </div>
          </div>
        </button>
      </li>
    </ul>
  </aside>
</template>
