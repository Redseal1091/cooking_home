<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Clock, Flame, Minus, Play, Plus, Timer, Users, X } from 'lucide-vue-next';
import {
  calculateNutritionPerServing,
  getScaleFactorByServings,
  groupScaledIngredientsBySection,
  parseTimeTokens,
  scaleIngredients,
  type Ingredient,
  type TipTapNode,
} from '@cookbook/shared';
import type { RecipeDraft } from '@/stores/recipes';

const props = defineProps<{
  open: boolean;
  draft: RecipeDraft;
}>();

const emit = defineEmits<{
  close: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const previewServings = ref(4);
const showVideoPlayer = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (isOpen) {
      previewServings.value = Math.max(1, props.draft.base_servings || 2);
      showVideoPlayer.value = false;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  },
);

function handleDialogClose() {
  if (dialogRef.value) dialogRef.value.returnValue = '';
  emit('close');
}

function handleBackdropClick(e: PointerEvent) {
  const dialog = dialogRef.value;
  if (!dialog) return;
  const r = dialog.getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  ) {
    dialog.close();
  }
}

const scaleFactor = computed(() =>
  getScaleFactorByServings(props.draft.base_servings || 1, previewServings.value),
);

const scaledIngredients = computed(() => {
  const asIngredients: Ingredient[] = props.draft.ingredients
    .filter((i) => i.name.trim())
    .map((i, idx) => ({
      id: i.localId,
      recipe_id: props.draft.id ?? 'preview',
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      is_scalable: i.is_scalable,
      section_name: i.section_name ?? null,
      order_index: idx,
    }));
  return scaleIngredients(asIngredients, scaleFactor.value);
});

const groupedIngredients = computed(() =>
  groupScaledIngredientsBySection(scaledIngredients.value),
);

const perServing = computed(() =>
  calculateNutritionPerServing({
    base_servings: props.draft.base_servings || 1,
    total_weight_g: props.draft.total_weight_g,
    calories: props.draft.calories,
    proteins: props.draft.proteins,
    fats: props.draft.fats,
    carbs: props.draft.carbs,
  }),
);

function extractPlainText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(extractPlainText).join('');
}

interface TextSegment {
  text: string;
  isTimer: boolean;
}

function splitTextWithTimers(text: string): TextSegment[] {
  const tokens = parseTimeTokens(text);
  if (tokens.length === 0) return [{ text, isTimer: false }];

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.startIndex > cursor) {
      segments.push({ text: text.slice(cursor, token.startIndex), isTimer: false });
    }
    segments.push({ text: token.raw, isTimer: true });
    cursor = token.endIndex;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isTimer: false });
  }

  return segments;
}
</script>

<template>
  <dialog
    ref="dialogRef"
    aria-labelledby="preview-modal-title"
    class="m-auto max-h-[94dvh] w-full max-w-[430px] overflow-visible rounded-[44px] border-0 bg-transparent p-2 shadow-none"
    @close="handleDialogClose"
    @pointerdown="handleBackdropClick"
  >
    <div
      class="relative flex max-h-[90dvh] flex-col overflow-hidden rounded-[40px] border-[6px] border-[#1F221F] bg-canvas shadow-organic-lg"
    >
      <!-- Верхняя панель телефона -->
      <div class="flex items-center justify-between border-b border-hairline bg-surface/80 px-5 py-3 backdrop-blur-md">
        <span id="preview-modal-title" class="font-display text-xs font-bold uppercase tracking-wider text-ink-secondary">
          Мобильный предпросмотр
        </span>
        <button
          type="button"
          autofocus
          aria-label="Закрыть предпросмотр"
          class="tactile rounded-full bg-surface-muted p-1.5 text-ink hover:bg-accent hover:text-accent-contrast"
          @click="dialogRef?.close()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <!-- Контент рецепта как в Android-приложении -->
      <div class="flex-1 overflow-y-auto pb-8">
        <!-- Медиа-шапка -->
        <div class="relative aspect-[4/3] w-full bg-surface-muted">
          <video
            v-if="showVideoPlayer && draft.video_preview_url"
            :src="draft.video_preview_url"
            controls
            autoplay
            playsinline
            class="h-full w-full object-cover"
          />
          <img
            v-else-if="draft.cover_url"
            :src="draft.cover_url"
            :alt="draft.title || 'Обложка'"
            class="h-full w-full object-cover"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-xs text-ink-tertiary">
            Без обложки
          </div>

          <div
            v-if="!showVideoPlayer"
            class="pointer-events-none absolute inset-0 bg-hero-scrim"
          />

          <!-- Glassmorphism бейджи -->
          <div class="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
            <span class="glass-pill rounded-full px-3 py-1 text-[11px] font-semibold">
              {{ draft.category }}
            </span>
            <span
              v-if="perServing.calories !== null"
              class="glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums"
            >
              <Flame class="h-3 w-3" aria-hidden="true" />
              {{ perServing.calories }} ккал/порц.
            </span>
          </div>

          <!-- Play превью-видео -->
          <button
            v-if="draft.video_preview_url && !showVideoPlayer"
            type="button"
            class="tactile glass-pill absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold"
            @click="showVideoPlayer = true"
          >
            <Play class="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Видео
          </button>

          <div v-if="!showVideoPlayer" class="absolute bottom-4 left-4 right-20">
            <h4 class="font-display text-xl font-extrabold leading-tight text-white">
              {{ draft.title || 'Название блюда' }}
            </h4>
          </div>
        </div>

        <div class="space-y-4 p-4">
          <p v-if="draft.description" class="text-xs leading-relaxed text-ink-secondary">
            {{ draft.description }}
          </p>

          <!-- Плашка ключевых метрик -->
          <div class="grid grid-cols-3 gap-2 rounded-3xl border border-hairline bg-surface p-3 shadow-organic-sm">
            <div class="text-center">
              <div class="flex items-center justify-center gap-1 text-[10px] text-ink-tertiary">
                <Clock class="h-3 w-3" aria-hidden="true" />
                Подготовка
              </div>
              <div class="mt-0.5 text-xs font-semibold text-ink tabular-nums">
                {{ draft.prep_time_min }} мин
              </div>
            </div>
            <div class="border-x border-hairline text-center">
              <div class="flex items-center justify-center gap-1 text-[10px] text-ink-tertiary">
                <Clock class="h-3 w-3" aria-hidden="true" />
                Готовка
              </div>
              <div class="mt-0.5 text-xs font-semibold text-ink tabular-nums">
                {{ draft.cook_time_min }} мин
              </div>
            </div>
            <div class="text-center">
              <div class="flex items-center justify-center gap-1 text-[10px] text-ink-tertiary">
                <Users class="h-3 w-3" aria-hidden="true" />
                Порции
              </div>
              <div class="mt-0.5 text-xs font-semibold text-accent tabular-nums">
                {{ previewServings }}
              </div>
            </div>
          </div>

          <!-- Блок КБЖУ на 1 порцию -->
          <div
            v-if="perServing.calories !== null"
            class="grid grid-cols-4 gap-2 rounded-3xl border border-hairline bg-surface p-3 text-center shadow-organic-sm tabular-nums"
          >
            <div>
              <div class="text-[10px] text-ink-tertiary">Ккал</div>
              <div class="text-xs font-bold text-ink">{{ perServing.calories }}</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-tertiary">Белки</div>
              <div class="text-xs font-bold text-ink">{{ perServing.proteins ?? '—' }} г</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-tertiary">Жиры</div>
              <div class="text-xs font-bold text-ink">{{ perServing.fats ?? '—' }} г</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-tertiary">Углеводы</div>
              <div class="text-xs font-bold text-ink">{{ perServing.carbs ?? '—' }} г</div>
            </div>
          </div>

          <!-- Ингредиенты + интерактивный пересчёт -->
          <div class="rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
            <div class="mb-3 flex items-center justify-between">
              <h5 class="font-display text-sm font-bold text-ink">Ингредиенты</h5>
              <div class="inline-flex items-center gap-1.5 rounded-full bg-surface-muted p-1">
                <button
                  type="button"
                  aria-label="Уменьшить порции"
                  class="tactile rounded-full bg-surface p-1 text-ink shadow-organic-sm"
                  @click="previewServings = Math.max(1, previewServings - 1)"
                >
                  <Minus class="h-3 w-3" aria-hidden="true" />
                </button>
                <span class="px-1.5 text-xs font-semibold text-ink tabular-nums">
                  {{ previewServings }}
                </span>
                <button
                  type="button"
                  aria-label="Увеличить порции"
                  class="tactile rounded-full bg-surface p-1 text-ink shadow-organic-sm"
                  @click="previewServings++"
                >
                  <Plus class="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div class="space-y-3">
              <div v-for="(group, gIdx) in groupedIngredients" :key="group.sectionName ?? `g-${gIdx}`">
                <p
                  v-if="group.sectionName"
                  class="mb-1 text-[11px] font-bold uppercase tracking-wider text-accent"
                >
                  {{ group.sectionName }}
                </p>
                <ul class="divide-y divide-hairline text-xs">
                  <li
                    v-for="ing in group.items"
                    :key="ing.id"
                    class="flex items-center justify-between gap-2 py-2"
                  >
                    <span class="min-w-0 flex-1 break-words text-ink">
                      {{ ing.name }}
                      <span v-if="!ing.is_scalable" class="ml-1 text-[10px] text-ink-tertiary">
                        (фикс.)
                      </span>
                    </span>
                    <span class="shrink-0 font-semibold text-accent tabular-nums">
                      {{ ing.formattedAmount }} {{ ing.unit }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Блоки шагов из TipTap -->
          <div class="space-y-3 rounded-3xl border border-hairline bg-surface p-4 shadow-organic-sm">
            <h5 class="font-display text-sm font-bold text-ink">Приготовление</h5>

            <template v-for="(node, idx) in draft.content_blocks.content" :key="idx">
              <h6
                v-if="node.type === 'heading'"
                class="font-display text-sm font-bold text-ink pt-1"
              >
                {{ extractPlainText(node) }}
              </h6>

              <p
                v-else-if="node.type === 'paragraph' && extractPlainText(node)"
                class="text-xs leading-relaxed text-ink"
              >
                <template
                  v-for="(seg, sIdx) in splitTextWithTimers(extractPlainText(node))"
                  :key="sIdx"
                >
                  <span
                    v-if="seg.isTimer"
                    class="mx-0.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent tabular-nums"
                  >
                    <Timer class="h-3 w-3" aria-hidden="true" />
                    {{ seg.text }}
                  </span>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </p>

              <ol
                v-else-if="node.type === 'orderedList'"
                class="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-ink"
              >
                <li v-for="(li, lIdx) in node.content" :key="lIdx">
                  <template
                    v-for="(seg, sIdx) in splitTextWithTimers(extractPlainText(li))"
                    :key="sIdx"
                  >
                    <span
                      v-if="seg.isTimer"
                      class="mx-0.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent tabular-nums"
                    >
                      <Timer class="h-3 w-3" aria-hidden="true" />
                      {{ seg.text }}
                    </span>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </li>
              </ol>

              <ul
                v-else-if="node.type === 'bulletList'"
                class="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink"
              >
                <li v-for="(li, lIdx) in node.content" :key="lIdx">
                  {{ extractPlainText(li) }}
                </li>
              </ul>

              <img
                v-else-if="node.type === 'image' && node.attrs?.src"
                :src="String(node.attrs.src)"
                alt="Шаг приготовления"
                class="w-full rounded-2xl object-cover shadow-organic-sm"
              />

              <div
                v-else-if="node.type === 'videoBlock' && node.attrs?.src"
                class="overflow-hidden rounded-2xl bg-black"
              >
                <video
                  :src="String(node.attrs.src)"
                  controls
                  playsinline
                  class="max-h-52 w-full object-contain"
                />
                <p
                  v-if="node.attrs?.caption"
                  class="bg-surface-muted px-3 py-1.5 text-[11px] text-ink-secondary"
                >
                  {{ node.attrs.caption }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </dialog>
</template>
