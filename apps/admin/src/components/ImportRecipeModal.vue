<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-vue-next';
import { useRecipesStore, type RecipeDraft } from '@/stores/recipes';
import {
  AI_PROMPT_TEMPLATE,
  downloadCsvExampleFile,
  parseRecipesFromCsvText,
  parseRecipesFromJsonText,
} from '@/utils/recipeImport';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  fillSingle: [draft: RecipeDraft];
  batchImported: [count: number];
}>();

const recipesStore = useRecipesStore();
const dialogRef = ref<HTMLDialogElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const activeMode = ref<'ai' | 'file'>('ai');
const jsonInput = ref('');
const copiedPrompt = ref(false);
const clipboardError = ref<string | null>(null);

const fileName = ref<string | null>(null);
const fileParsedDrafts = ref<RecipeDraft[]>([]);
const fileParseError = ref<string | null>(null);

const batchRunning = ref(false);
const batchDone = ref(0);
const batchTotal = ref(0);
const batchError = ref<string | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      batchError.value = null;
      clipboardError.value = null;
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  },
);

function handleDialogClose() {
  if (dialogRef.value) dialogRef.value.returnValue = '';
  emit('close');
}

function onBackdropClick(event: MouseEvent) {
  if (!batchRunning.value && event.target === event.currentTarget) {
    dialogRef.value?.close();
  }
}

const aiParseResult = computed<{ drafts: RecipeDraft[]; error: string | null }>(() => {
  if (!jsonInput.value.trim()) {
    return { drafts: [], error: null };
  }
  try {
    return { drafts: parseRecipesFromJsonText(jsonInput.value), error: null };
  } catch (err) {
    return {
      drafts: [],
      error: err instanceof Error ? err.message : 'Ошибка разбора JSON',
    };
  }
});

const activeDrafts = computed(() =>
  activeMode.value === 'ai' ? aiParseResult.value.drafts : fileParsedDrafts.value,
);

const activeError = computed(() =>
  activeMode.value === 'ai' ? aiParseResult.value.error : fileParseError.value,
);

async function copyPromptTemplate() {
  try {
    await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    copiedPrompt.value = true;
    setTimeout(() => {
      copiedPrompt.value = false;
    }, 2500);
  } catch {
    clipboardError.value = 'Не удалось скопировать в буфер обмена (проверьте права браузера).';
  }
}

async function pasteFromClipboard() {
  clipboardError.value = null;
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      clipboardError.value = 'Буфер обмена пуст.';
      return;
    }
    jsonInput.value = text;
  } catch {
    clipboardError.value = 'Браузер не разрешил чтение буфера. Нажмите Ctrl+V прямо в поле ниже.';
  }
}

async function processUploadedFile(file: File) {
  fileParseError.value = null;
  fileParsedDrafts.value = [];
  fileName.value = file.name;

  try {
    const text = await file.text();
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.json')) {
      fileParsedDrafts.value = parseRecipesFromJsonText(text);
    } else if (lower.endsWith('.csv')) {
      fileParsedDrafts.value = parseRecipesFromCsvText(text);
    } else {
      throw new Error('Поддерживаются только файлы .json и .csv');
    }
  } catch (err) {
    fileParseError.value = err instanceof Error ? err.message : 'Не удалось прочитать файл';
  }
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void processUploadedFile(file);
}

function onFileDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];
  if (file) void processUploadedFile(file);
}

function fillCurrentRecipe(draft: RecipeDraft) {
  emit('fillSingle', draft);
  dialogRef.value?.close();
}

async function runBatchImport(drafts: RecipeDraft[]) {
  if (drafts.length === 0) return;
  batchRunning.value = true;
  batchDone.value = 0;
  batchTotal.value = drafts.length;
  batchError.value = null;

  const count = await recipesStore.importRecipesBatch(drafts, (done, total) => {
    batchDone.value = done;
    batchTotal.value = total;
  });

  batchRunning.value = false;

  if (recipesStore.error) {
    batchError.value = `${recipesStore.error} (Успешно сохранено: ${count} из ${drafts.length})`;
    return;
  }

  emit('batchImported', count);
  dialogRef.value?.close();
}

function countSteps(draft: RecipeDraft): number {
  const content = draft.content_blocks?.content ?? [];
  let total = 0;
  for (const node of content) {
    if (node.type === 'orderedList' || node.type === 'bulletList') {
      total += node.content?.length ?? 0;
    } else if (node.type === 'paragraph' && node.content?.length) {
      total += 1;
    }
  }
  return total;
}
</script>

<template>
  <dialog
    ref="dialogRef"
    aria-labelledby="import-modal-title"
    class="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-4xl border border-hairline bg-surface p-0 text-ink shadow-organic-lg"
    @close="handleDialogClose"
    @click="onBackdropClick"
  >
    <div class="flex max-h-[92dvh] flex-col">
      <!-- Шапка модального окна -->
      <div class="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles class="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="import-modal-title" class="font-display text-lg font-bold text-ink">
              Быстрый импорт (ИИ / Таблица)
            </h2>
            <p class="text-xs text-ink-secondary">
              Заполните конструктор за секунду или загрузите сразу несколько рецептов.
            </p>
          </div>
        </div>

        <button
          type="button"
          :disabled="batchRunning"
          aria-label="Закрыть окно импорта"
          class="tactile rounded-full bg-surface-muted p-2 text-ink-secondary hover:text-ink disabled:opacity-40"
          @click="dialogRef?.close()"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <!-- Переключатель способов загрузки -->
      <div class="border-b border-hairline bg-canvas/50 px-6 py-3">
        <div class="inline-flex rounded-full border border-hairline bg-surface p-1">
          <button
            type="button"
            class="tactile inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
            :class="
              activeMode === 'ai'
                ? 'bg-accent text-accent-contrast shadow-organic-sm'
                : 'text-ink-secondary hover:text-ink'
            "
            @click="activeMode = 'ai'"
          >
            <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
            <span>Вставка JSON от ИИ</span>
          </button>

          <button
            type="button"
            class="tactile inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
            :class="
              activeMode === 'file'
                ? 'bg-accent text-accent-contrast shadow-organic-sm'
                : 'text-ink-secondary hover:text-ink'
            "
            @click="activeMode = 'file'"
          >
            <FileSpreadsheet class="h-3.5 w-3.5" aria-hidden="true" />
            <span>Файл (.json или .csv)</span>
          </button>
        </div>
      </div>

      <!-- Тело модального окна -->
      <div class="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <!-- Режим 1: Вставка JSON от ИИ -->
        <template v-if="activeMode === 'ai'">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              class="tactile inline-flex items-center gap-1.5 rounded-2xl border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
              @click="copyPromptTemplate"
            >
              <Check v-if="copiedPrompt" class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <Copy v-else class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>
                {{ copiedPrompt ? 'Промпт скопирован!' : 'Скопировать шаблон промпта для ИИ' }}
              </span>
            </button>

            <button
              type="button"
              class="tactile inline-flex items-center gap-1.5 rounded-2xl bg-accent-soft px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-contrast"
              @click="pasteFromClipboard"
            >
              <ClipboardPaste class="h-3.5 w-3.5" aria-hidden="true" />
              <span>Вставить из буфера обмена</span>
            </button>
          </div>

          <div
            v-if="clipboardError"
            class="rounded-2xl border border-warm/30 bg-warm/10 px-3.5 py-2 text-xs text-warm"
          >
            {{ clipboardError }}
          </div>

          <div>
            <label for="ai-json-textarea" class="mb-1.5 block text-xs font-semibold text-ink-secondary">
              JSON-объект рецепта или массив рецептов [...]
            </label>
            <textarea
              id="ai-json-textarea"
              v-model="jsonInput"
              rows="8"
              autofocus
              spellcheck="false"
              placeholder='{
  "title": "Борщ домашний",
  "category": "Супы",
  "prep_time_min": 25,
  "cook_time_min": 60,
  "base_servings": 6,
  "ingredients": [{ "name": "Говядина", "amount": 500, "unit": "г", "is_scalable": true }],
  "steps": ["Отварите мясо 45 мин.", "Добавьте овощи и варите ещё 20 мин."]
}'
              class="w-full rounded-2xl border border-hairline bg-canvas/80 p-3.5 font-mono text-xs leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
            />
          </div>
        </template>

        <!-- Режим 2: Загрузка файла (.json / .csv) -->
        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-ink-secondary">
              Формат CSV: разделитель <code class="rounded bg-surface-muted px-1.5 py-0.5">;</code>, ингредиенты через <code class="rounded bg-surface-muted px-1.5 py-0.5">|</code>.
            </p>
            <button
              type="button"
              class="tactile inline-flex items-center gap-1.5 rounded-2xl border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
              @click="downloadCsvExampleFile"
            >
              <Download class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Скачать пример CSV-таблицы</span>
            </button>
          </div>

          <input
            ref="fileInputRef"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            class="hidden"
            @change="onFileSelected"
          />

          <button
            type="button"
            class="tactile flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-hairline bg-canvas/60 px-6 py-8 text-center hover:border-accent hover:bg-accent-soft/25"
            @dragover.prevent
            @drop.prevent="onFileDrop"
            @click="fileInputRef?.click()"
          >
            <UploadCloud class="h-9 w-9 text-accent" aria-hidden="true" />
            <span class="text-sm font-semibold text-ink">
              {{ fileName ? `Выбран файл: ${fileName}` : 'Перетащите .json или .csv файл сюда' }}
            </span>
            <span class="text-xs text-ink-tertiary">
              или нажмите, чтобы выбрать файл на компьютере
            </span>
          </button>
        </template>

        <!-- Ошибка парсинга -->
        <div
          v-if="activeError"
          role="alert"
          class="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger"
        >
          {{ activeError }}
        </div>

        <!-- Превью распознанных рецептов -->
        <div
          v-if="activeDrafts.length > 0"
          class="space-y-2.5 rounded-3xl border border-hairline bg-canvas/70 p-4"
        >
          <div class="flex items-center justify-between">
            <span class="font-display text-sm font-bold text-ink">
              Найдено рецептов: {{ activeDrafts.length }}
            </span>
            <span class="text-[11px] text-accent font-semibold">
              Готово к импорту
            </span>
          </div>

          <ul class="max-h-48 space-y-2 overflow-y-auto pr-1">
            <li
              v-for="(item, idx) in activeDrafts"
              :key="idx"
              class="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-3.5 py-2.5 text-xs"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-display text-sm font-bold text-ink">
                  {{ item.title }}
                </p>
                <p class="mt-0.5 text-[11px] text-ink-secondary tabular-nums">
                  {{ item.category }} · {{ item.ingredients.length }} ингр. · {{ countSteps(item) }} шагов · {{ item.base_servings }} порц.
                </p>
              </div>

              <button
                v-if="activeDrafts.length > 1"
                type="button"
                class="tactile shrink-0 rounded-xl bg-surface-muted px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-accent-soft hover:text-accent"
                @click="fillCurrentRecipe(item)"
              >
                В редактор
              </button>
            </li>
          </ul>
        </div>

        <!-- Прогресс-бар пакетного импорта -->
        <div v-if="batchRunning" class="space-y-2 rounded-2xl bg-accent-soft p-3.5">
          <div class="flex items-center justify-between text-xs font-semibold text-accent tabular-nums">
            <span class="inline-flex items-center gap-1.5">
              <Loader2 class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Импортируем рецепты в Supabase...
            </span>
            <span>{{ batchDone }} из {{ batchTotal }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-surface">
            <div
              class="h-full rounded-full bg-accent transition-all duration-300"
              :style="{ width: `${batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0}%` }"
            />
          </div>
        </div>

        <div
          v-if="batchError"
          role="alert"
          class="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger"
        >
          {{ batchError }}
        </div>
      </div>

      <!-- Нижняя панель кнопок -->
      <div class="flex flex-wrap items-center justify-end gap-2.5 border-t border-hairline bg-canvas/50 px-6 py-4">
        <button
          type="button"
          :disabled="batchRunning"
          class="tactile rounded-2xl border border-hairline bg-surface px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
          @click="dialogRef?.close()"
        >
          Отмена
        </button>

        <template v-if="activeDrafts.length === 1">
          <button
            type="button"
            :disabled="batchRunning"
            class="tactile inline-flex items-center gap-1.5 rounded-2xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-contrast shadow-organic-sm hover:bg-accent-hover disabled:opacity-50"
            @click="fillCurrentRecipe(activeDrafts[0])"
          >
            <FileUp class="h-4 w-4" aria-hidden="true" />
            <span>Заполнить рецепт</span>
          </button>
        </template>

        <template v-else-if="activeDrafts.length > 1">
          <button
            type="button"
            :disabled="batchRunning"
            class="tactile inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-contrast shadow-organic-md hover:bg-accent-hover disabled:opacity-50"
            @click="runBatchImport(activeDrafts)"
          >
            <Sparkles class="h-4 w-4" aria-hidden="true" />
            <span>Сохранить все рецепты сразу в базу ({{ activeDrafts.length }})</span>
          </button>
        </template>
      </div>
    </div>
  </dialog>
</template>
