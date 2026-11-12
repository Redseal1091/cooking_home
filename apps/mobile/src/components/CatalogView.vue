<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Clock,
  Flame,
  Plus,
  Refrigerator,
  Search,
  Sparkles,
  UtensilsCrossed,
  WifiOff,
  X,
} from 'lucide-vue-next';
import {
  DEFAULT_RECIPE_CATEGORIES,
  normalizeIngredient,
  type RecipeWithIngredients,
} from '@cookbook/shared';
import { useAppStore } from '@/stores/app';
import { useMobileRecipesStore } from '@/stores/recipes';
import CachedImage from '@/components/CachedImage.vue';

const emit = defineEmits<{
  openRecipe: [recipe: RecipeWithIngredients];
}>();

const appStore = useAppStore();
const recipesStore = useMobileRecipesStore();

const searchQuery = ref('');
const selectedCategory = ref<string>('Все');
const showPantryFilter = ref(false);
const pantryInput = ref('');
const pantryIngredients = ref<string[]>([]);

watch(showPantryFilter, (open) => {
  if (open) {
    appStore.pushBackHandler('pantry-filter-panel', () => {
      showPantryFilter.value = false;
    });
  } else {
    appStore.removeBackHandler('pantry-filter-panel');
  }
});

const categories = computed(() => {
  const fromRecipes = recipesStore.recipes.map((r) => r.category);
  const merged = Array.from(new Set(['Все', ...DEFAULT_RECIPE_CATEGORIES, ...fromRecipes]));
  return merged;
});

const suggestedIngredients = computed(() =>
  recipesStore.allIngredientNames
    .filter((name) => !pantryIngredients.value.some((p) => p.toLowerCase() === name.toLowerCase()))
    .slice(0, 10),
);

function addPantryIngredient(raw?: string) {
  const clean = normalizeIngredient(raw ?? pantryInput.value).name;
  if (!clean) return;
  if (!pantryIngredients.value.some((p) => p.toLowerCase() === clean.toLowerCase())) {
    pantryIngredients.value.push(clean);
  }
  if (!raw) pantryInput.value = '';
}

function removePantryIngredient(idx: number) {
  pantryIngredients.value.splice(idx, 1);
}

interface RankedRecipe {
  recipe: RecipeWithIngredients;
  matchedCount: number;
  totalIngredients: number;
}

const filteredRecipes = computed<RankedRecipe[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const cat = selectedCategory.value;
  const pantryTerms = pantryIngredients.value.map((p) => p.toLowerCase());

  const list: RankedRecipe[] = [];

  for (const recipe of recipesStore.recipes) {
    if (cat !== 'Все' && recipe.category !== cat) continue;

    if (q) {
      const inTitle = recipe.title.toLowerCase().includes(q);
      const inDesc = (recipe.description ?? '').toLowerCase().includes(q);
      const inIng = recipe.ingredients.some((i) =>
        normalizeIngredient(i.name).name.toLowerCase().includes(q),
      );
      if (!inTitle && !inDesc && !inIng) continue;
    }

    let matchedCount = 0;
    if (pantryTerms.length > 0) {
      for (const term of pantryTerms) {
        const hasMatch = recipe.ingredients.some((ing) =>
          normalizeIngredient(ing.name).name.toLowerCase().includes(term),
        );
        if (hasMatch) matchedCount++;
      }
      if (matchedCount === 0) continue;
    }

    list.push({
      recipe,
      matchedCount,
      totalIngredients: recipe.ingredients.length,
    });
  }

  if (pantryTerms.length > 0) {
    list.sort((a, b) => b.matchedCount - a.matchedCount);
  }

  return list;
});

const carouselRecipes = computed(() => filteredRecipes.value.slice(0, 6));

function getTotalMinutes(r: RecipeWithIngredients): number {
  return (r.prep_time_min || 0) + (r.cook_time_min || 0);
}

function getCaloriesPer100g(r: RecipeWithIngredients): number | null {
  return r.calories !== null && r.calories !== undefined ? Math.round(r.calories) : null;
}
</script>

<template>
  <div class="overflow-x-clip pb-28">
    <!-- Закреплённая шапка каталога без разделительных рамок и полос -->
    <header class="sticky top-0 z-20 bg-canvas/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),2rem)] backdrop-blur-xl sm:px-5">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-[#FDF0D5]">
            <img
              src="/mascot.png"
              alt="Пухня"
              class="h-full w-full object-cover"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h1 class="truncate font-display text-2xl font-extrabold leading-tight text-ink">
                Пухня
              </h1>
            </div>
            <p class="truncate text-xs font-medium text-ink-secondary">
              Что приготовим сегодня?
            </p>
          </div>
        </div>

        <span
          v-if="recipesStore.isOffline"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warm/30 bg-warm/15 px-3 py-1.5 text-[11px] font-semibold text-warm"
        >
          <WifiOff class="h-3.5 w-3.5" aria-hidden="true" />
          Офлайн
        </span>
      </div>
    </header>

    <!-- Поиск и фильтр по холодильнику -->
    <div class="px-4 pb-2 pt-3 sm:px-5">
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search
            class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
            aria-hidden="true"
          />
          <input
            v-model="searchQuery"
            type="search"
            enterkeyhint="search"
            placeholder="Название или продукт..."
            aria-label="Поиск рецептов"
            class="w-full min-w-0 rounded-2xl border border-hairline bg-surface py-3 pl-10 pr-3 text-sm text-ink shadow-organic-sm placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="button"
          class="tactile relative inline-flex h-[46px] shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold shadow-organic-sm sm:px-3.5"
          :class="
            showPantryFilter || pantryIngredients.length > 0
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-hairline bg-surface text-ink'
          "
          :aria-expanded="showPantryFilter"
          @click="showPantryFilter = !showPantryFilter"
        >
          <Refrigerator class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="hidden sm:inline">Дома</span>
          <span
            v-if="pantryIngredients.length > 0"
            class="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] tabular-nums"
          >
            {{ pantryIngredients.length }}
          </span>
        </button>
      </div>

      <!-- Панель «Из того, что есть дома» -->
      <div
        v-if="showPantryFilter"
        class="mt-3 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-md sm:p-4"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="min-w-0 flex-1 truncate font-display text-sm font-bold text-ink">
            Что есть в холодильнике?
          </span>
          <button
            v-if="pantryIngredients.length > 0"
            type="button"
            class="shrink-0 text-xs font-medium text-danger"
            @click="pantryIngredients = []"
          >
            Сбросить
          </button>
        </div>

        <form class="flex items-center gap-2" @submit.prevent="addPantryIngredient()">
          <input
            v-model="pantryInput"
            type="text"
            placeholder="Например: курица, картофель..."
            class="min-w-0 flex-1 rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            class="tactile inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-contrast"
          >
            <Plus class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Добавить</span>
          </button>
        </form>

        <!-- Выбранные продукты -->
        <div v-if="pantryIngredients.length > 0" class="mt-2.5 flex flex-wrap gap-1.5">
          <button
            v-for="(item, idx) in pantryIngredients"
            :key="item"
            type="button"
            class="tactile inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-contrast"
            @click="removePantryIngredient(idx)"
          >
            <span>{{ item }}</span>
            <X class="h-3 w-3" aria-hidden="true" />
          </button>
        </div>

        <!-- Быстрые подсказки из базы рецептов -->
        <div v-if="suggestedIngredients.length > 0" class="mt-3">
          <p class="mb-1.5 text-[11px] text-ink-tertiary">Частые ингредиенты:</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="ing in suggestedIngredients"
              :key="ing"
              type="button"
              class="tactile rounded-full border border-hairline bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:border-accent hover:text-accent"
              @click="addPantryIngredient(ing)"
            >
              + {{ ing }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Горизонтальные pill-фильтры категорий -->
    <div class="no-scrollbar touch-pan-xy flex gap-2 overflow-x-auto px-5 py-2" role="tablist" aria-label="Категории рецептов">
      <button
        v-for="cat in categories"
        :key="cat"
        type="button"
        role="tab"
        :aria-selected="selectedCategory === cat"
        class="tactile shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors"
        :class="
          selectedCategory === cat
            ? 'bg-accent text-accent-contrast shadow-organic-sm'
            : 'border border-hairline bg-surface text-ink-secondary hover:text-ink'
        "
        @click="selectedCategory = cat"
      >
        {{ cat }}
      </button>
    </div>

    <!-- Состояние загрузки / пустой список -->
    <div v-if="recipesStore.loading" class="px-5 py-16 text-center text-sm text-ink-secondary">
      Загружаем семейные рецепты...
    </div>

    <div
      v-else-if="filteredRecipes.length === 0"
      class="mx-5 mt-6 flex flex-col items-center rounded-4xl border border-dashed border-hairline bg-surface/60 p-8 text-center"
    >
      <UtensilsCrossed class="mb-3 h-9 w-9 text-ink-tertiary" aria-hidden="true" />
      <p class="font-display text-base font-bold text-ink">Ничего не найдено</p>
      <p class="mt-1 text-xs text-ink-secondary">
        Попробуйте изменить фильтр категории или очистить поиск.
      </p>
    </div>

    <template v-else>
      <!-- Карусель карточек (Apple Organic Minimalism + Glassmorphism) -->
      <section
        v-if="carouselRecipes.length > 0"
        class="mt-3"
        aria-roledescription="carousel"
        aria-label="Избранные рецепты"
      >
        <div class="mb-2.5 flex items-center justify-between px-5">
          <h2 class="flex items-center gap-1.5 font-display text-base font-bold text-ink">
            <Sparkles class="h-4 w-4 text-accent" aria-hidden="true" />
            <span>{{ pantryIngredients.length > 0 ? 'Лучшие совпадения' : 'Вдохновение дня' }}</span>
          </h2>
          <span class="text-xs text-ink-tertiary tabular-nums">
            {{ filteredRecipes.length }} рец.
          </span>
        </div>

        <div class="snap-carousel no-scrollbar gap-4 px-5 pb-3">
          <button
            v-for="{ recipe, matchedCount } in carouselRecipes"
            :key="recipe.id"
            type="button"
            class="snap-carousel-item tactile organic-card squircle group relative h-72 w-[78vw] max-w-[300px] shrink-0 overflow-hidden rounded-4xl bg-surface-muted text-left shadow-organic-md"
            @click="emit('openRecipe', recipe)"
          >
            <CachedImage
              :src="recipe.cover_url"
              :alt="recipe.title"
              img-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div class="pointer-events-none absolute inset-0 bg-hero-scrim" />

            <!-- Верхние glassmorphism-бейджи -->
            <div class="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
              <span class="glass-pill truncate rounded-full px-3 py-1 text-[11px] font-semibold">
                {{ recipe.category }}
              </span>
              <span
                v-if="getCaloriesPer100g(recipe) !== null"
                class="glass-pill inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
              >
                <Flame class="h-3 w-3" aria-hidden="true" />
                {{ getCaloriesPer100g(recipe) }} ккал / 100 г
              </span>
            </div>

            <!-- Нижний контент карточки -->
            <div class="absolute bottom-4 left-4 right-4">
              <div
                v-if="pantryIngredients.length > 0"
                class="mb-1.5 inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold text-white"
              >
                Совпадает: {{ matchedCount }} из {{ pantryIngredients.length }}
              </div>
              <h3 class="line-clamp-2 font-display text-lg font-extrabold leading-snug text-white">
                {{ recipe.title }}
              </h3>
              <div class="mt-1.5 flex items-center gap-3 text-xs text-white/85 tabular-nums">
                <span class="inline-flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ getTotalMinutes(recipe) }} мин
                </span>
                <span>·</span>
                <span>{{ recipe.base_servings }} порц.</span>
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- Полный список рецептов -->
      <section class="mt-4 px-4 sm:px-5">
        <h2 class="mb-3 font-display text-base font-bold text-ink">Все рецепты</h2>

        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <button
            v-for="{ recipe, matchedCount } in filteredRecipes"
            :key="`list-${recipe.id}`"
            type="button"
            class="tactile organic-card squircle flex min-w-0 items-center gap-3 rounded-3xl border border-hairline bg-surface p-3 text-left shadow-organic-sm sm:gap-3.5"
            @click="emit('openRecipe', recipe)"
          >
            <div class="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-muted sm:h-24 sm:w-24">
              <CachedImage
                :src="recipe.cover_url"
                :alt="recipe.title"
                img-class="h-full w-full object-cover"
              />
              <span
                class="glass-pill absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
              >
                <Clock class="h-2.5 w-2.5" aria-hidden="true" />
                {{ getTotalMinutes(recipe) }}м
              </span>
            </div>

            <div class="min-w-0 flex-1">
              <span class="inline-block max-w-full truncate rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                {{ recipe.category }}
              </span>
              <h3 class="mt-1 line-clamp-2 break-words font-display text-base font-bold leading-snug text-ink">
                {{ recipe.title }}
              </h3>
              <div class="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary tabular-nums">
                <span>{{ recipe.base_servings }} порц.</span>
                <template v-if="getCaloriesPer100g(recipe) !== null">
                  <span>·</span>
                  <span>{{ getCaloriesPer100g(recipe) }} ккал / 100 г</span>
                </template>
                <template v-if="pantryIngredients.length > 0">
                  <span>·</span>
                  <span class="font-semibold text-accent">есть {{ matchedCount }}</span>
                </template>
              </div>
            </div>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
