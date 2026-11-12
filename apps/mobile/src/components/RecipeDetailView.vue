<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  MessageSquarePlus,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShoppingBasket,
  Sun,
  Timer,
  Users,
} from 'lucide-vue-next';
import {
  calculateNutritionPerServing,
  calculateScaledTotalNutrition,
  formatAmount,
  getScaleFactorByServings,
  parseTimeTokens,
  scaleIngredients,
  type RecipeWithIngredients,
  type ScaledIngredient,
  type TipTapNode,
} from '@cookbook/shared';
import { useWakeLock } from '@/composables/useWakeLock';
import { useTimers } from '@/composables/useTimers';
import { useMobileRecipesStore } from '@/stores/recipes';
import { useShoppingListStore } from '@/stores/shoppingList';
import CachedImage from '@/components/CachedImage.vue';
import ReverseCalculatorModal from '@/components/ReverseCalculatorModal.vue';

const props = defineProps<{
  recipe: RecipeWithIngredients;
}>();

const emit = defineEmits<{
  back: [];
}>();

const { wakeLockActive } = useWakeLock();
const { startTimer } = useTimers();
const recipesStore = useMobileRecipesStore();
const shoppingStore = useShoppingListStore();

const scaleFactor = ref(1);
const showVideoPlayer = ref(false);
const checkedIngredients = ref<Set<string>>(new Set());
const checkedSteps = ref<Set<string>>(new Set());
const reverseTarget = ref<ScaledIngredient | null>(null);

const addingToShopping = ref(false);
const shoppingFeedback = ref<string | null>(null);
const newNoteText = ref('');
const savingNote = ref(false);

onMounted(() => {
  void recipesStore.fetchNotes(props.recipe.id);
});

const currentServings = computed(() => {
  const base = props.recipe.base_servings || 1;
  return Math.max(0.5, Math.round(base * scaleFactor.value * 10) / 10);
});

const scaledIngredients = computed(() =>
  scaleIngredients(props.recipe.ingredients, scaleFactor.value),
);

const nutritionPerServing = computed(() => calculateNutritionPerServing(props.recipe));
const nutritionScaledTotal = computed(() =>
  calculateScaledTotalNutrition(props.recipe, scaleFactor.value),
);

const recipeNotes = computed(() => recipesStore.notesByRecipe[props.recipe.id] ?? []);

function stepServings(delta: number) {
  const base = props.recipe.base_servings || 1;
  const nextServings = Math.max(1, Math.round(currentServings.value + delta));
  scaleFactor.value = getScaleFactorByServings(base, nextServings);
}

function setMultiplier(mult: number) {
  scaleFactor.value = mult;
}

function applyReverseFactor(newFactor: number) {
  scaleFactor.value = newFactor;
}

function toggleIngredientCheck(id: string) {
  const next = new Set(checkedIngredients.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  checkedIngredients.value = next;
}

function toggleStepCheck(key: string) {
  const next = new Set(checkedSteps.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  checkedSteps.value = next;
}

async function handleAddAllToShopping() {
  addingToShopping.value = true;
  try {
    const toAdd = scaledIngredients.value.filter((ing) => !checkedIngredients.value.has(ing.id));
    const listToUse = toAdd.length > 0 ? toAdd : scaledIngredients.value;
    const count = await shoppingStore.addIngredientsFromRecipe(listToUse, props.recipe.title);
    shoppingFeedback.value = `Добавлено в список покупок: ${count}`;
    setTimeout(() => {
      shoppingFeedback.value = null;
    }, 3000);
  } finally {
    addingToShopping.value = false;
  }
}

async function handleSaveNote() {
  if (!newNoteText.value.trim()) return;
  savingNote.value = true;
  try {
    const ok = await recipesStore.addNote(props.recipe.id, newNoteText.value);
    if (ok) newNoteText.value = '';
  } finally {
    savingNote.value = false;
  }
}

function extractText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(extractText).join('');
}

interface TextPart {
  text: string;
  seconds?: number;
  label?: string;
}

function tokenizeTimers(text: string): TextPart[] {
  const tokens = parseTimeTokens(text);
  if (tokens.length === 0) return [{ text }];

  const parts: TextPart[] = [];
  let cursor = 0;

  for (const tok of tokens) {
    if (tok.startIndex > cursor) {
      parts.push({ text: text.slice(cursor, tok.startIndex) });
    }
    parts.push({
      text: tok.raw,
      seconds: tok.seconds,
      label: tok.label,
    });
    cursor = tok.endIndex;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }

  return parts;
}

function formatNoteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
</script>

<template>
  <div class="pb-32">
    <!-- Медиа-шапка -->
    <div class="relative aspect-[4/3] max-h-[380px] w-full bg-surface-muted">
      <video
        v-if="showVideoPlayer && recipe.video_preview_url"
        :src="recipe.video_preview_url"
        controls
        autoplay
        playsinline
        class="h-full w-full object-cover"
      />
      <CachedImage
        v-else
        :src="recipe.cover_url"
        :alt="recipe.title"
        img-class="h-full w-full object-cover"
      />

      <div
        v-if="!showVideoPlayer"
        class="pointer-events-none absolute inset-0 bg-hero-scrim"
      />

      <!-- Верхние кнопки управления -->
      <div class="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Назад к каталогу"
          class="tactile glass-pill inline-flex h-10 w-10 items-center justify-center rounded-full"
          @click="emit('back')"
        >
          <ArrowLeft class="h-5 w-5" aria-hidden="true" />
        </button>

        <div class="flex items-center gap-2">
          <span
            v-if="wakeLockActive"
            class="glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium"
          >
            <Sun class="h-3.5 w-3.5 text-[#E8C58E]" aria-hidden="true" />
            Экран активен
          </span>
          <span class="glass-pill rounded-full px-3 py-1.5 text-[11px] font-semibold">
            {{ recipe.category }}
          </span>
        </div>
      </div>

      <!-- Кнопка Play превью-видео -->
      <button
        v-if="recipe.video_preview_url && !showVideoPlayer"
        type="button"
        class="tactile glass-pill absolute bottom-6 right-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-glass"
        @click="showVideoPlayer = true"
      >
        <Play class="h-4 w-4 fill-current" aria-hidden="true" />
        <span>Смотреть видео</span>
      </button>

      <div v-if="!showVideoPlayer" class="absolute bottom-6 left-5 right-28">
        <h1 class="font-display text-2xl font-extrabold leading-tight text-white drop-shadow-sm">
          {{ recipe.title }}
        </h1>
      </div>
    </div>

    <!-- Основная карточка контента с плавным наездом на обложку -->
    <div class="relative -mt-4 space-y-5 rounded-t-4xl bg-canvas px-5 pt-6">
      <p v-if="recipe.description" class="text-sm leading-relaxed text-ink-secondary">
        {{ recipe.description }}
      </p>

      <!-- Плашка ключевых метрик -->
      <div class="organic-card grid grid-cols-3 gap-2 rounded-3xl border border-hairline bg-surface p-3.5 shadow-organic-sm">
        <div class="text-center">
          <div class="flex items-center justify-center gap-1 text-[11px] text-ink-tertiary">
            <Clock class="h-3.5 w-3.5" aria-hidden="true" />
            Подготовка
          </div>
          <div class="mt-1 text-sm font-bold text-ink tabular-nums">
            {{ recipe.prep_time_min }} мин
          </div>
        </div>

        <div class="border-x border-hairline text-center">
          <div class="flex items-center justify-center gap-1 text-[11px] text-ink-tertiary">
            <Clock class="h-3.5 w-3.5" aria-hidden="true" />
            Готовка
          </div>
          <div class="mt-1 text-sm font-bold text-ink tabular-nums">
            {{ recipe.cook_time_min }} мин
          </div>
        </div>

        <div class="text-center">
          <div class="flex items-center justify-center gap-1 text-[11px] text-ink-tertiary">
            <Users class="h-3.5 w-3.5" aria-hidden="true" />
            Порции
          </div>
          <div class="mt-1 text-sm font-bold text-accent tabular-nums">
            {{ formatAmount(currentServings) }}
          </div>
        </div>
      </div>

      <!-- КБЖУ на 1 порцию + общий пересчитанный выход -->
      <div
        v-if="nutritionPerServing.calories !== null"
        class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm"
      >
        <div class="mb-2.5 flex items-center justify-between text-xs">
          <span class="flex items-center gap-1.5 font-display font-bold text-ink">
            <Flame class="h-4 w-4 text-accent" aria-hidden="true" />
            КБЖУ на 1 порцию
          </span>
          <span v-if="nutritionScaledTotal.calories !== null" class="text-[11px] text-ink-tertiary tabular-nums">
            Всего сейчас: {{ nutritionScaledTotal.calories }} ккал
          </span>
        </div>

        <div class="grid grid-cols-4 gap-2 text-center tabular-nums">
          <div class="rounded-2xl bg-canvas/80 py-2">
            <div class="text-[10px] text-ink-tertiary">Ккал</div>
            <div class="text-sm font-bold text-ink">{{ nutritionPerServing.calories }}</div>
          </div>
          <div class="rounded-2xl bg-canvas/80 py-2">
            <div class="text-[10px] text-ink-tertiary">Белки</div>
            <div class="text-sm font-bold text-ink">{{ nutritionPerServing.proteins ?? '—' }} г</div>
          </div>
          <div class="rounded-2xl bg-canvas/80 py-2">
            <div class="text-[10px] text-ink-tertiary">Жиры</div>
            <div class="text-sm font-bold text-ink">{{ nutritionPerServing.fats ?? '—' }} г</div>
          </div>
          <div class="rounded-2xl bg-canvas/80 py-2">
            <div class="text-[10px] text-ink-tertiary">Углев.</div>
            <div class="text-sm font-bold text-ink">{{ nutritionPerServing.carbs ?? '—' }} г</div>
          </div>
        </div>
      </div>

      <!-- Ингредиенты + Умный калькулятор -->
      <section class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-display text-lg font-bold text-ink">Ингредиенты</h2>
            <p class="text-[11px] text-ink-secondary">
              Нажмите на вес продукта, чтобы пересчитать от остатков.
            </p>
          </div>

          <div class="inline-flex items-center gap-1.5 rounded-full bg-surface-muted p-1">
            <button
              type="button"
              aria-label="Уменьшить порции"
              class="tactile flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink shadow-organic-sm"
              @click="stepServings(-1)"
            >
              <Minus class="h-4 w-4" aria-hidden="true" />
            </button>
            <span class="min-w-[44px] text-center text-xs font-bold text-ink tabular-nums">
              {{ formatAmount(currentServings) }}
            </span>
            <button
              type="button"
              aria-label="Увеличить порции"
              class="tactile flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink shadow-organic-sm"
              @click="stepServings(1)"
            >
              <Plus class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <!-- Быстрые множители -->
        <div class="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            v-for="mult in [0.5, 1, 1.5, 2]"
            :key="mult"
            type="button"
            class="tactile rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
            :class="
              Math.abs(scaleFactor - mult) < 0.01
                ? 'bg-accent text-accent-contrast'
                : 'bg-canvas text-ink-secondary'
            "
            @click="setMultiplier(mult)"
          >
            {{ mult }}x
          </button>

          <button
            v-if="Math.abs(scaleFactor - 1) >= 0.01"
            type="button"
            class="tactile ml-auto inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-secondary"
            @click="scaleFactor = 1"
          >
            <RotateCcw class="h-3 w-3" aria-hidden="true" />
            Сброс ({{ scaleFactor.toFixed(2).replace('.', ',') }}x)
          </button>
        </div>

        <!-- Список ингредиентов с чекбоксами -->
        <ul class="mt-4 divide-y divide-hairline">
          <li
            v-for="ing in scaledIngredients"
            :key="ing.id"
            class="flex items-center justify-between gap-3 py-2.5"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              @click="toggleIngredientCheck(ing.id)"
            >
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors"
                :class="
                  checkedIngredients.has(ing.id)
                    ? 'border-accent bg-accent text-white'
                    : 'border-hairline bg-canvas'
                "
              >
                <Check v-if="checkedIngredients.has(ing.id)" class="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span
                class="truncate text-sm transition-opacity"
                :class="
                  checkedIngredients.has(ing.id)
                    ? 'text-ink-tertiary line-through opacity-70'
                    : 'text-ink'
                "
              >
                {{ ing.name }}
              </span>
            </button>

            <button
              v-if="ing.is_scalable && ing.amount !== null"
              type="button"
              title="Нажмите для пересчёта от остатков"
              class="tactile shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent tabular-nums hover:bg-accent hover:text-accent-contrast"
              @click="reverseTarget = ing"
            >
              {{ ing.formattedAmount }} {{ ing.unit }}
            </button>
            <span
              v-else
              class="shrink-0 px-2 text-xs font-medium text-ink-secondary tabular-nums"
            >
              {{ ing.formattedAmount }} {{ ing.unit }}
            </span>
          </li>
        </ul>

        <!-- Кнопка добавить в семейный список покупок -->
        <button
          type="button"
          :disabled="addingToShopping || scaledIngredients.length === 0"
          class="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-semibold text-accent-contrast shadow-organic-sm hover:bg-accent-hover disabled:opacity-50"
          @click="handleAddAllToShopping"
        >
          <ShoppingBasket class="h-4 w-4" aria-hidden="true" />
          <span>
            {{ addingToShopping ? 'Добавляем...' : 'Добавить в список покупок' }}
          </span>
        </button>

        <p
          v-if="shoppingFeedback"
          role="status"
          class="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-accent"
        >
          <CheckCircle2 class="h-3.5 w-3.5" aria-hidden="true" />
          {{ shoppingFeedback }}
        </p>
      </section>

      <!-- Шаги приготовления (TipTap + Умные таймеры) -->
      <section class="organic-card space-y-3.5 rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
        <h2 class="font-display text-lg font-bold text-ink">Приготовление</h2>

        <template v-for="(node, idx) in recipe.content_blocks?.content ?? []" :key="idx">
          <h3
            v-if="node.type === 'heading'"
            class="pt-1 font-display text-base font-bold text-ink"
          >
            {{ extractText(node) }}
          </h3>

          <div
            v-else-if="node.type === 'paragraph' && extractText(node)"
            class="flex items-start gap-3"
          >
            <button
              type="button"
              :aria-label="`Отметить шаг ${idx + 1}`"
              class="tactile mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors"
              :class="
                checkedSteps.has(`p-${idx}`)
                  ? 'border-accent bg-accent text-white'
                  : 'border-hairline bg-canvas'
              "
              @click="toggleStepCheck(`p-${idx}`)"
            >
              <Check v-if="checkedSteps.has(`p-${idx}`)" class="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <p
              class="flex-1 text-sm leading-relaxed transition-opacity"
              :class="checkedSteps.has(`p-${idx}`) ? 'text-ink-tertiary line-through opacity-75' : 'text-ink'"
            >
              <template v-for="(part, pIdx) in tokenizeTimers(extractText(node))" :key="pIdx">
                <button
                  v-if="part.seconds"
                  type="button"
                  class="tactile mx-0.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent tabular-nums hover:bg-accent hover:text-accent-contrast"
                  @click.stop="startTimer(part.seconds, part.label || part.text, recipe.title)"
                >
                  <Timer class="h-3 w-3" aria-hidden="true" />
                  {{ part.text }}
                </button>
                <template v-else>{{ part.text }}</template>
              </template>
            </p>
          </div>

          <ol
            v-else-if="node.type === 'orderedList'"
            class="space-y-2.5"
          >
            <li
              v-for="(li, lIdx) in node.content"
              :key="lIdx"
              class="flex items-start gap-3"
            >
              <button
                type="button"
                class="tactile mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors"
                :class="
                  checkedSteps.has(`ol-${idx}-${lIdx}`)
                    ? 'bg-accent text-white'
                    : 'bg-surface-muted text-ink-secondary'
                "
                @click="toggleStepCheck(`ol-${idx}-${lIdx}`)"
              >
                <Check v-if="checkedSteps.has(`ol-${idx}-${lIdx}`)" class="h-3.5 w-3.5" aria-hidden="true" />
                <span v-else>{{ lIdx + 1 }}</span>
              </button>

              <span
                class="flex-1 text-sm leading-relaxed"
                :class="
                  checkedSteps.has(`ol-${idx}-${lIdx}`)
                    ? 'text-ink-tertiary line-through opacity-75'
                    : 'text-ink'
                "
              >
                <template v-for="(part, pIdx) in tokenizeTimers(extractText(li))" :key="pIdx">
                  <button
                    v-if="part.seconds"
                    type="button"
                    class="tactile mx-0.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent tabular-nums"
                    @click.stop="startTimer(part.seconds, part.label || part.text, recipe.title)"
                  >
                    <Timer class="h-3 w-3" aria-hidden="true" />
                    {{ part.text }}
                  </button>
                  <template v-else>{{ part.text }}</template>
                </template>
              </span>
            </li>
          </ol>

          <ul
            v-else-if="node.type === 'bulletList'"
            class="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink"
          >
            <li v-for="(li, lIdx) in node.content" :key="lIdx">
              <template v-for="(part, pIdx) in tokenizeTimers(extractText(li))" :key="pIdx">
                <button
                  v-if="part.seconds"
                  type="button"
                  class="tactile mx-0.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent tabular-nums"
                  @click.stop="startTimer(part.seconds, part.label || part.text, recipe.title)"
                >
                  <Timer class="h-3 w-3" aria-hidden="true" />
                  {{ part.text }}
                </button>
                <template v-else>{{ part.text }}</template>
              </template>
            </li>
          </ul>

          <div
            v-else-if="node.type === 'image' && typeof node.attrs?.src === 'string'"
            class="overflow-hidden rounded-3xl bg-surface-muted shadow-organic-sm"
          >
            <CachedImage
              :src="node.attrs.src"
              alt="Пошаговое фото"
              img-class="max-h-72 w-full object-cover"
            />
          </div>

          <div
            v-else-if="node.type === 'videoBlock' && typeof node.attrs?.src === 'string'"
            class="overflow-hidden rounded-3xl bg-black shadow-organic-sm"
          >
            <video
              :src="node.attrs.src"
              controls
              playsinline
              preload="metadata"
              class="max-h-72 w-full object-contain"
            />
            <p
              v-if="node.attrs?.caption"
              class="bg-surface-muted px-3.5 py-2 text-xs text-ink-secondary"
            >
              {{ node.attrs.caption }}
            </p>
          </div>
        </template>
      </section>

      <!-- Семейные заметки на будущее -->
      <section class="organic-card rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
        <h2 class="font-display text-lg font-bold text-ink">Заметки семьи</h2>
        <p class="mt-0.5 text-xs text-ink-secondary">
          Запишите советы на будущее: температуру духовки, количество сахара или любимую подачу.
        </p>

        <form class="mt-3 flex gap-2" @submit.prevent="handleSaveNote">
          <input
            v-model="newNoteText"
            type="text"
            placeholder="Добавить заметку..."
            class="flex-1 rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            :disabled="savingNote || !newNoteText.trim()"
            aria-label="Сохранить заметку"
            class="tactile inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-2.5 text-accent-contrast disabled:opacity-50"
          >
            <MessageSquarePlus class="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <ul v-if="recipeNotes.length > 0" class="mt-3.5 space-y-2">
          <li
            v-for="note in recipeNotes"
            :key="note.id"
            class="rounded-2xl bg-canvas/80 px-3.5 py-2.5 text-xs leading-relaxed text-ink"
          >
            <p>{{ note.note_text }}</p>
            <span class="mt-1 block text-[10px] text-ink-tertiary">
              {{ formatNoteDate(note.created_at) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <!-- Модалка обратного калькулятора -->
    <ReverseCalculatorModal
      :open="Boolean(reverseTarget)"
      :ingredient="reverseTarget"
      @close="reverseTarget = null"
      @apply="applyReverseFactor"
    />
  </div>
</template>
