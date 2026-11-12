<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Clock,
  Inbox,
  Link2,
  Plus,
  Search,
  Sparkles,
  User,
  UtensilsCrossed,
} from 'lucide-vue-next';
import type { Recipe, RecipeSuggestion } from '@cookbook/shared';

export type SidebarTab = 'recipes' | 'suggestions';

const props = defineProps<{
  recipes: Recipe[];
  suggestions: RecipeSuggestion[];
  pendingSuggestionsCount: number;
  selectedId?: string;
  selectedSuggestionId?: string;
  loading: boolean;
  loadingSuggestions: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  selectSuggestion: [suggestion: RecipeSuggestion];
  create: [];
}>();

const activeTab = ref<SidebarTab>('recipes');
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

const filteredSuggestions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const base = !q
    ? props.suggestions
    : props.suggestions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.author_name ?? '').toLowerCase().includes(q) ||
          (s.notes ?? '').toLowerCase().includes(q),
      );
  return [...base].sort((a, b) => {
    const order = { pending: 0, published: 1, rejected: 2 } as const;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return b.created_at.localeCompare(a.created_at);
  });
});

function statusBadge(status: RecipeSuggestion['status']) {
  if (status === 'pending') {
    return { label: 'Новая', class: 'bg-warm/15 text-warm border-warm/30' };
  }
  if (status === 'published') {
    return { label: 'Опубликовано', class: 'bg-accent-soft text-accent border-accent/25' };
  }
  return { label: 'Отклонена', class: 'bg-danger/10 text-danger border-danger/20' };
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}
</script>

<template>
  <aside
    class="organic-card flex h-full flex-col rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm"
  >
    <!-- Переключатель вкладок Рецепты / Предложенные -->
    <div class="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-canvas/80 p-1">
      <button
        type="button"
        class="tactile flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors"
        :class="
          activeTab === 'recipes'
            ? 'bg-surface text-ink shadow-organic-sm'
            : 'text-ink-secondary hover:text-ink'
        "
        @click="activeTab = 'recipes'"
      >
        <span>Рецепты</span>
        <span class="text-[11px] text-ink-tertiary tabular-nums">({{ recipes.length }})</span>
      </button>

      <button
        type="button"
        class="tactile flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors"
        :class="
          activeTab === 'suggestions'
            ? 'bg-surface text-ink shadow-organic-sm'
            : 'text-ink-secondary hover:text-ink'
        "
        @click="activeTab = 'suggestions'"
      >
        <span>Заявки</span>
        <span
          v-if="pendingSuggestionsCount > 0"
          class="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-contrast tabular-nums"
        >
          {{ pendingSuggestionsCount }}
        </span>
      </button>
    </div>

    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="font-display text-base font-bold text-ink">
        {{ activeTab === 'recipes' ? 'Книга «Пухня»' : 'Предложенные рецепты' }}
      </h2>
      <button
        v-if="activeTab === 'recipes'"
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
        :placeholder="
          activeTab === 'recipes'
            ? 'Поиск по названию или категории...'
            : 'Поиск по названию или автору...'
        "
        aria-label="Поиск"
        class="w-full rounded-2xl border border-hairline bg-canvas/80 py-2.5 pl-9 pr-3 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
      />
    </div>

    <!-- Вкладка 1: Список опубликованных рецептов -->
    <template v-if="activeTab === 'recipes'">
      <div
        v-if="loading"
        class="flex flex-1 items-center justify-center py-10 text-xs text-ink-secondary"
      >
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
    </template>

    <!-- Вкладка 2: Предложенные рецепты от семьи -->
    <template v-else>
      <div
        v-if="loadingSuggestions"
        class="flex flex-1 items-center justify-center py-10 text-xs text-ink-secondary"
      >
        Загрузка заявок...
      </div>

      <div
        v-else-if="filteredSuggestions.length === 0"
        class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-hairline p-6 text-center"
      >
        <Inbox class="mb-2 h-7 w-7 text-ink-tertiary" aria-hidden="true" />
        <p class="text-sm font-medium text-ink">Заявок пока нет</p>
        <p class="mt-1 text-xs text-ink-secondary">
          Идеи, отправленные семьёй из мобильного приложения, появятся здесь.
        </p>
      </div>

      <ul v-else class="flex-1 space-y-2 overflow-y-auto pr-1">
        <li v-for="sug in filteredSuggestions" :key="sug.id">
          <button
            type="button"
            class="tactile w-full rounded-2xl border p-3 text-left transition-all"
            :class="
              selectedSuggestionId === sug.id
                ? 'border-accent bg-accent-soft/70 shadow-organic-sm'
                : 'border-transparent bg-canvas/55 hover:border-hairline hover:bg-surface-muted/60'
            "
            @click="emit('selectSuggestion', sug)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="line-clamp-2 min-w-0 flex-1 font-display text-sm font-bold text-ink">
                {{ sug.title }}
              </p>
              <span
                class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                :class="statusBadge(sug.status).class"
              >
                {{ statusBadge(sug.status).label }}
              </span>
            </div>

            <div class="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
              <span
                v-if="sug.author_name"
                class="inline-flex items-center gap-1"
              >
                <User class="h-3 w-3" aria-hidden="true" />
                {{ sug.author_name }}
              </span>
              <span class="inline-flex items-center gap-1">
                <Sparkles class="h-3 w-3 text-accent" aria-hidden="true" />
                {{ sug.mode === 'full' ? 'Полная форма' : 'Идея' }}
              </span>
              <span v-if="sug.source_url" class="inline-flex items-center gap-0.5 text-accent">
                <Link2 class="h-3 w-3" aria-hidden="true" />
                Источник
              </span>
              <span class="ml-auto text-[10px] text-ink-tertiary tabular-nums">
                {{ formatShortDate(sug.created_at) }}
              </span>
            </div>
          </button>
        </li>
      </ul>
    </template>
  </aside>
</template>
