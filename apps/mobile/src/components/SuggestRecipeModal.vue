<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-vue-next';
import {
  DEFAULT_INGREDIENT_SECTIONS,
  DEFAULT_RECIPE_CATEGORIES,
  INGREDIENT_UNITS,
  normalizeIngredient,
  type SuggestedIngredientInput,
  type TipTapDocument,
} from '@cookbook/shared';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/app';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submitted: [message: string];
}>();

interface LocalIngredientRow {
  localId: string;
  name: string;
  amount: string;
  unit: string;
  is_scalable: boolean;
  section_name: string;
}

const appStore = useAppStore();
const dialogRef = ref<HTMLDialogElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const isFullMode = ref(false);
const submitting = ref(false);
const uploadingPhoto = ref(false);
const errorMsg = ref<string | null>(null);

// Базовые поля
const title = ref('');
const notes = ref('');
const sourceUrl = ref('');
const authorName = ref('');

// Расширенные поля конструктора
const category = ref<string>('Основные блюда');
const coverUrl = ref<string | null>(null);
const prepTimeMin = ref<number>(15);
const cookTimeMin = ref<number>(30);
const baseServings = ref<number>(4);
const totalWeightG = ref<string>('');
const calories = ref<string>('');
const proteins = ref<string>('');
const fats = ref<string>('');
const carbs = ref<string>('');

const ingredients = ref<LocalIngredientRow[]>([createIngredientRow()]);
const steps = ref<string[]>(['']);
const showSectionPicker = ref(false);
const customSectionName = ref('');

function createIngredientRow(sectionName = ''): LocalIngredientRow {
  return {
    localId:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    name: '',
    amount: '',
    unit: 'г',
    is_scalable: true,
    section_name: sectionName,
  };
}

const sectionSuggestions = computed(() => {
  const used = ingredients.value.map((i) => i.section_name.trim()).filter(Boolean);
  return Array.from(new Set([...DEFAULT_INGREDIENT_SECTIONS, ...used]));
});

function resetForm() {
  isFullMode.value = false;
  submitting.value = false;
  uploadingPhoto.value = false;
  errorMsg.value = null;
  title.value = '';
  notes.value = '';
  sourceUrl.value = '';
  authorName.value = '';
  category.value = 'Основные блюда';
  coverUrl.value = null;
  prepTimeMin.value = 15;
  cookTimeMin.value = 30;
  baseServings.value = 4;
  totalWeightG.value = '';
  calories.value = '';
  proteins.value = '';
  fats.value = '';
  carbs.value = '';
  ingredients.value = [createIngredientRow()];
  steps.value = [''];
  showSectionPicker.value = false;
  customSectionName.value = '';
}

watch(
  () => props.open,
  (isOpen) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (isOpen) {
      errorMsg.value = null;
      if (!dialog.open) dialog.showModal();
      appStore.pushBackHandler('suggest-recipe-modal', () => {
        dialogRef.value?.close();
      });
    } else {
      appStore.removeBackHandler('suggest-recipe-modal');
      if (dialog.open) dialog.close();
    }
  },
);

function handleDialogClose() {
  appStore.removeBackHandler('suggest-recipe-modal');
  if (dialogRef.value) dialogRef.value.returnValue = '';
  emit('close');
}

function onBackdropClick(event: MouseEvent) {
  if (!submitting.value && event.target === event.currentTarget) {
    dialogRef.value?.close();
  }
}

function addIngredient(sectionName = '') {
  ingredients.value.push(createIngredientRow(sectionName));
}

function createSectionAndAddRow(preset?: string) {
  const sec = (preset ?? customSectionName.value).trim();
  if (!sec) return;
  ingredients.value.push(createIngredientRow(sec));
  if (!preset) customSectionName.value = '';
  showSectionPicker.value = false;
}

function removeIngredient(idx: number) {
  ingredients.value.splice(idx, 1);
  if (ingredients.value.length === 0) {
    ingredients.value.push(createIngredientRow());
  }
}

function addStep() {
  steps.value.push('');
}

function removeStep(idx: number) {
  steps.value.splice(idx, 1);
  if (steps.value.length === 0) {
    steps.value.push('');
  }
}

function parseOptionalNumber(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  if (!clean) return null;
  const num = Number.parseFloat(clean);
  return Number.isNaN(num) || num < 0 ? null : num;
}

function buildTipTapDoc(): TipTapDocument {
  const cleanSteps = steps.value.map((s) => s.trim()).filter(Boolean);
  if (cleanSteps.length === 0) {
    const cleanNotes = notes.value.trim();
    if (!cleanNotes) {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }
    return {
      type: 'doc',
      content: cleanNotes
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: l }],
        })),
    };
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'orderedList',
        content: cleanSteps.map((stepText) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: stepText }],
            },
          ],
        })),
      },
    ],
  };
}

async function compressPhotoToWebpOrJpeg(file: File): Promise<{ blob: Blob; ext: string; mime: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      el.src = objectUrl;
    });

    const maxDim = 1400;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round((h / w) * maxDim);
        w = maxDim;
      } else {
        w = Math.round((w / h) * maxDim);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен');
    ctx.drawImage(img, 0, 0, w, h);

    const webpBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/webp', 0.82),
    );
    if (webpBlob && webpBlob.size > 0 && webpBlob.type === 'image/webp') {
      return { blob: webpBlob, ext: 'webp', mime: 'image/webp' };
    }

    const jpgBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.84),
    );
    if (!jpgBlob) throw new Error('Не удалось сжать фото');
    return { blob: jpgBlob, ext: 'jpg', mime: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function handlePhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  if (!navigator.onLine) {
    errorMsg.value = 'Для загрузки фото нужно подключение к интернету.';
    return;
  }

  uploadingPhoto.value = true;
  errorMsg.value = null;
  try {
    const compressed = await compressPhotoToWebpOrJpeg(file);
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `suggestions/${id}.${compressed.ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('recipe-media')
      .upload(path, compressed.blob, {
        contentType: compressed.mime,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    const { data } = supabase.storage.from('recipe-media').getPublicUrl(path);
    coverUrl.value = data.publicUrl;
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Ошибка загрузки фото';
  } finally {
    uploadingPhoto.value = false;
  }
}

async function handleSubmit() {
  const cleanTitle = title.value.trim();
  if (!cleanTitle) {
    errorMsg.value = 'Укажите название рецепта.';
    return;
  }

  if (!navigator.onLine) {
    errorMsg.value = 'Нет интернета. Подключитесь к сети, чтобы отправить предложение.';
    return;
  }

  submitting.value = true;
  errorMsg.value = null;

  try {
    const preparedIngredients: SuggestedIngredientInput[] = isFullMode.value
      ? ingredients.value
          .map((row) => {
            const normalized = normalizeIngredient(row.name, row.section_name);
            return {
              row,
              name: normalized.name,
              section_name: normalized.section_name,
            };
          })
          .filter((item) => item.name.length > 0)
          .map((item) => ({
            name: item.name,
            amount: parseOptionalNumber(item.row.amount),
            unit: item.row.unit.trim() || 'г',
            is_scalable: item.row.is_scalable,
            section_name: item.section_name,
          }))
      : [];

    const payload = {
      status: 'pending',
      mode: isFullMode.value ? 'full' : 'quick',
      title: cleanTitle,
      notes: notes.value.trim() || null,
      source_url: sourceUrl.value.trim() || null,
      author_name: authorName.value.trim() || null,
      category: isFullMode.value ? category.value : 'Основные блюда',
      cover_url: isFullMode.value ? coverUrl.value : null,
      prep_time_min: isFullMode.value ? Math.max(0, Number(prepTimeMin.value) || 0) : 0,
      cook_time_min: isFullMode.value ? Math.max(0, Number(cookTimeMin.value) || 0) : 0,
      base_servings: isFullMode.value ? Math.max(1, Number(baseServings.value) || 4) : 4,
      total_weight_g: isFullMode.value
        ? (() => {
            const w = parseOptionalNumber(totalWeightG.value);
            return w && w > 0 ? Math.round(w) : null;
          })()
        : null,
      calories: isFullMode.value ? parseOptionalNumber(calories.value) : null,
      proteins: isFullMode.value ? parseOptionalNumber(proteins.value) : null,
      fats: isFullMode.value ? parseOptionalNumber(fats.value) : null,
      carbs: isFullMode.value ? parseOptionalNumber(carbs.value) : null,
      ingredients: preparedIngredients,
      content_blocks: isFullMode.value
        ? buildTipTapDoc()
        : { type: 'doc', content: [{ type: 'paragraph' }] },
    };

    const { error: insertErr } = await supabase.from('recipe_suggestions').insert(payload);
    if (insertErr) throw insertErr;

    const msg = isFullMode.value
      ? 'Спасибо! Ваш рецепт отправлен редактору книги.'
      : 'Спасибо! Идея рецепта отправлена в семейную книгу.';
    resetForm();
    dialogRef.value?.close();
    emit('submitted', msg);
  } catch (err) {
    errorMsg.value =
      err instanceof Error ? err.message : 'Не удалось отправить рецепт. Попробуйте ещё раз.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <dialog
    ref="dialogRef"
    aria-labelledby="suggest-modal-title"
    class="open:flex fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col items-center justify-end overflow-hidden border-0 bg-transparent p-0 pt-[max(18dvh,calc(env(safe-area-inset-top)+3rem))] sm:justify-center sm:px-4 sm:pb-6"
    @close="handleDialogClose"
    @click="onBackdropClick"
  >
    <datalist id="mobile-ingredient-sections">
      <option v-for="sec in sectionSuggestions" :key="sec" :value="sec" />
    </datalist>

    <div
      class="flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-b-0 border-hairline bg-surface text-ink shadow-organic-lg sm:rounded-3xl sm:border-b"
    >
      <!-- Зафиксированная сверху шапка модалки -->
      <div class="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles class="h-4 w-4" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <h3 id="suggest-modal-title" class="truncate font-display text-base font-bold text-ink">
              Предложить рецепт
            </h3>
            <p class="truncate text-[11px] text-ink-secondary">
              {{ isFullMode ? 'Полный конструктор рецепта' : 'Быстрая идея для семейной книги' }}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Закрыть"
          class="tactile shrink-0 rounded-full bg-surface-muted p-1.5 text-ink-secondary"
          @click="dialogRef?.close()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <!-- Прокручиваемое тело формы -->
      <form
        class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        @submit.prevent="handleSubmit"
      >
        <div
          v-if="errorMsg"
          role="alert"
          class="rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger"
        >
          {{ errorMsg }}
        </div>

        <!-- Базовые поля (всегда видны) -->
        <div class="space-y-3">
          <div>
            <label for="sug-title" class="mb-1 block text-xs font-semibold text-ink">
              Название рецепта *
            </label>
            <input
              id="sug-title"
              v-model="title"
              type="text"
              required
              placeholder="Например: Бабушкины блинчики на кефире"
              class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label for="sug-notes" class="mb-1 block text-xs font-semibold text-ink">
              {{ isFullMode ? 'Короткое описание / история блюда' : 'Текст / заметки' }}
            </label>
            <textarea
              id="sug-notes"
              v-model="notes"
              rows="3"
              placeholder="Напишите суть рецепта, продукты или пожелания..."
              class="w-full resize-y rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label for="sug-source" class="mb-1 block text-xs font-semibold text-ink">
                Ссылка на источник (опц.)
              </label>
              <input
                id="sug-source"
                v-model="sourceUrl"
                type="url"
                placeholder="https://..."
                class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label for="sug-author" class="mb-1 block text-xs font-semibold text-ink">
                Ваше имя (опц.)
              </label>
              <input
                id="sug-author"
                v-model="authorName"
                type="text"
                placeholder="Например: Мама, Дима..."
                class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- Полный конструктор (при нажатии «Подробнее») -->
        <div v-if="isFullMode" class="space-y-4 border-t border-hairline pt-4">
          <!-- Категория + Фото -->
          <div class="space-y-3">
            <div>
              <label for="sug-cat" class="mb-1 block text-xs font-semibold text-ink">
                Категория
              </label>
              <select
                id="sug-cat"
                v-model="category"
                class="w-full rounded-2xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option v-for="cat in DEFAULT_RECIPE_CATEGORIES" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </div>

            <div>
              <span class="mb-1 block text-xs font-semibold text-ink">Фотография блюда</span>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handlePhotoSelected"
              />

              <div v-if="coverUrl" class="relative overflow-hidden rounded-2xl border border-hairline">
                <img :src="coverUrl" alt="Обложка рецепта" class="h-40 w-full object-cover" />
                <button
                  type="button"
                  aria-label="Удалить фото"
                  class="tactile absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  @click="coverUrl = null"
                >
                  <X class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <button
                v-else
                type="button"
                :disabled="uploadingPhoto"
                class="tactile flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-canvas px-4 py-3 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-accent disabled:opacity-50"
                @click="fileInputRef?.click()"
              >
                <Loader2 v-if="uploadingPhoto" class="h-4 w-4 animate-spin" aria-hidden="true" />
                <Camera v-else class="h-4 w-4" aria-hidden="true" />
                <span>{{ uploadingPhoto ? 'Сжимаем и загружаем...' : 'Выбрать или снять фото' }}</span>
              </button>
            </div>
          </div>

          <!-- Время, порции, вес -->
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="mb-1 block text-[11px] font-semibold text-ink-secondary">
                Подготовка (мин)
              </label>
              <input
                v-model.number="prepTimeMin"
                type="number"
                min="0"
                inputmode="numeric"
                class="w-full rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink tabular-nums"
              />
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold text-ink-secondary">
                Готовка (мин)
              </label>
              <input
                v-model.number="cookTimeMin"
                type="number"
                min="0"
                inputmode="numeric"
                class="w-full rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink tabular-nums"
              />
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold text-ink-secondary">
                Порций
              </label>
              <input
                v-model.number="baseServings"
                type="number"
                min="1"
                inputmode="numeric"
                class="w-full rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink tabular-nums"
              />
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold text-ink-secondary">
                Выход (г)
              </label>
              <input
                v-model="totalWeightG"
                type="number"
                min="1"
                inputmode="numeric"
                placeholder="Опционально"
                class="w-full rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink tabular-nums"
              />
            </div>
          </div>

          <!-- КБЖУ -->
          <div>
            <p class="mb-1.5 text-xs font-semibold text-ink">КБЖУ на 100 г готового блюда (опционально)</p>
            <div class="grid grid-cols-4 gap-2">
              <input
                v-model="calories"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                placeholder="Ккал"
                class="min-w-0 rounded-xl border border-hairline bg-canvas px-2.5 py-2 text-xs text-ink tabular-nums"
              />
              <input
                v-model="proteins"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                placeholder="Белки"
                class="min-w-0 rounded-xl border border-hairline bg-canvas px-2.5 py-2 text-xs text-ink tabular-nums"
              />
              <input
                v-model="fats"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                placeholder="Жиры"
                class="min-w-0 rounded-xl border border-hairline bg-canvas px-2.5 py-2 text-xs text-ink tabular-nums"
              />
              <input
                v-model="carbs"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                placeholder="Углев."
                class="min-w-0 rounded-xl border border-hairline bg-canvas px-2.5 py-2 text-xs text-ink tabular-nums"
              />
            </div>
          </div>

          <!-- Ингредиенты с секциями -->
          <div class="space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-semibold text-ink">Ингредиенты</span>
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  class="tactile inline-flex items-center gap-1 rounded-xl border border-hairline bg-canvas px-2.5 py-1.5 text-[11px] font-semibold text-ink"
                  @click="showSectionPicker = !showSectionPicker"
                >
                  <FolderPlus class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  <span>+ Группа</span>
                </button>
                <button
                  type="button"
                  class="tactile inline-flex items-center gap-1 rounded-xl bg-accent-soft px-2.5 py-1.5 text-[11px] font-semibold text-accent"
                  @click="addIngredient()"
                >
                  <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ингредиент</span>
                </button>
              </div>
            </div>

            <div
              v-if="showSectionPicker"
              class="rounded-2xl border border-accent/25 bg-accent-soft/40 p-3 space-y-2"
            >
              <div class="flex gap-2">
                <input
                  v-model="customSectionName"
                  type="text"
                  placeholder="Название секции (Для теста...)"
                  class="min-w-0 flex-1 rounded-xl border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink"
                />
                <button
                  type="button"
                  :disabled="!customSectionName.trim()"
                  class="tactile shrink-0 rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-contrast disabled:opacity-50"
                  @click="createSectionAndAddRow()"
                >
                  Ок
                </button>
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="preset in DEFAULT_INGREDIENT_SECTIONS"
                  :key="preset"
                  type="button"
                  class="tactile rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-[10px] font-medium text-ink-secondary"
                  @click="createSectionAndAddRow(preset)"
                >
                  + {{ preset }}
                </button>
              </div>
            </div>

            <div
              v-for="(ing, idx) in ingredients"
              :key="ing.localId"
              class="space-y-2 rounded-2xl border border-hairline bg-canvas/70 p-2.5"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="ing.name"
                  type="text"
                  :placeholder="`Продукт ${idx + 1}`"
                  class="min-w-0 flex-1 rounded-xl border border-hairline bg-surface px-2.5 py-2 text-xs text-ink"
                />
                <button
                  type="button"
                  aria-label="Удалить ингредиент"
                  class="tactile shrink-0 rounded-xl p-1.5 text-ink-tertiary hover:text-danger"
                  @click="removeIngredient(idx)"
                >
                  <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div class="grid grid-cols-12 items-center gap-1.5">
                <input
                  v-model="ing.amount"
                  type="number"
                  min="0"
                  step="any"
                  inputmode="decimal"
                  placeholder="Кол-во"
                  class="col-span-4 min-w-0 rounded-xl border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink tabular-nums"
                />
                <select
                  v-model="ing.unit"
                  class="col-span-4 min-w-0 rounded-xl border border-hairline bg-surface px-2 py-1.5 text-xs text-ink"
                >
                  <option v-for="u in INGREDIENT_UNITS" :key="u" :value="u">
                    {{ u }}
                  </option>
                </select>
                <input
                  v-model="ing.section_name"
                  list="mobile-ingredient-sections"
                  type="text"
                  placeholder="Секция"
                  class="col-span-4 min-w-0 rounded-xl border border-hairline bg-surface px-2 py-1.5 text-[11px] text-ink"
                />
              </div>

              <label class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-secondary">
                <input
                  type="checkbox"
                  :checked="!ing.is_scalable"
                  class="h-3.5 w-3.5 rounded border-hairline"
                  @change="ing.is_scalable = !($event.target as HTMLInputElement).checked"
                />
                <span>Не масштабировать (соль, специи)</span>
              </label>
            </div>
          </div>

          <!-- Пошаговые блоки текста -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-ink">Шаги приготовления</span>
              <button
                type="button"
                class="tactile inline-flex items-center gap-1 rounded-xl bg-accent-soft px-2.5 py-1.5 text-[11px] font-semibold text-accent"
                @click="addStep"
              >
                <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                <span>Добавить шаг</span>
              </button>
            </div>

            <div
              v-for="(_, sIdx) in steps"
              :key="sIdx"
              class="flex items-start gap-2"
            >
              <span class="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-ink-secondary tabular-nums">
                {{ sIdx + 1 }}
              </span>
              <textarea
                v-model="steps[sIdx]"
                rows="2"
                :placeholder="`Опишите шаг ${sIdx + 1} (например: тушите 15 мин)...`"
                class="min-w-0 flex-1 resize-y rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs text-ink"
              />
              <button
                type="button"
                aria-label="Удалить шаг"
                class="tactile mt-1.5 shrink-0 rounded-xl p-1.5 text-ink-tertiary hover:text-danger"
                @click="removeStep(sIdx)"
              >
                <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <!-- Кнопки действий -->
        <div class="flex flex-col gap-2 pt-2">
          <button
            type="submit"
            :disabled="submitting || uploadingPhoto || !title.trim()"
            class="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-semibold text-accent-contrast shadow-organic-sm disabled:opacity-50"
          >
            <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
            <CheckCircle2 v-else-if="isFullMode" class="h-4 w-4" aria-hidden="true" />
            <Send v-else class="h-4 w-4" aria-hidden="true" />
            <span>
              {{
                submitting
                  ? 'Отправляем...'
                  : isFullMode
                    ? 'Отправить рецепт в книгу'
                    : 'Отправить идею'
              }}
            </span>
          </button>

          <button
            type="button"
            class="tactile flex w-full items-center justify-center gap-1.5 rounded-2xl border border-hairline bg-canvas px-4 py-2.5 text-xs font-semibold text-ink-secondary hover:text-ink"
            @click="isFullMode = !isFullMode"
          >
            <component :is="isFullMode ? ChevronUp : ChevronDown" class="h-4 w-4" aria-hidden="true" />
            <span>
              {{ isFullMode ? 'Свернуть в быструю идею' : 'Подробнее (полная форма)' }}
            </span>
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>
