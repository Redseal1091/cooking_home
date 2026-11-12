<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Inbox,
  LogOut,
  Save,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-vue-next';
import { DEFAULT_RECIPE_CATEGORIES, type RecipeSuggestion } from '@cookbook/shared';
import { useAuthStore } from '@/stores/auth';
import {
  createEmptyRecipeDraft,
  useRecipesStore,
  type RecipeDraft,
} from '@/stores/recipes';
import LoginView from '@/components/LoginView.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import RecipeSidebar from '@/components/RecipeSidebar.vue';
import MediaUploader from '@/components/MediaUploader.vue';
import NutritionFields from '@/components/NutritionFields.vue';
import IngredientsBuilder from '@/components/IngredientsBuilder.vue';
import TipTapEditor from '@/components/TipTapEditor.vue';
import MobilePreviewModal from '@/components/MobilePreviewModal.vue';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog.vue';
import ImportRecipeModal from '@/components/ImportRecipeModal.vue';

const auth = useAuthStore();
const recipesStore = useRecipesStore();

const draft = ref<RecipeDraft>(createEmptyRecipeDraft());
const activeSuggestion = ref<RecipeSuggestion | null>(null);
const previewOpen = ref(false);
const deleteDialogOpen = ref(false);
const importOpen = ref(false);
const toastMessage = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const categoryOptions = computed(() => {
  if (
    draft.value.category &&
    !DEFAULT_RECIPE_CATEGORIES.includes(draft.value.category)
  ) {
    return [draft.value.category, ...DEFAULT_RECIPE_CATEGORIES];
  }
  return DEFAULT_RECIPE_CATEGORIES;
});

function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = null;
  }, 3500);
}

onMounted(async () => {
  await auth.init();
});

watch(
  () => auth.isAuthenticated,
  async (loggedIn) => {
    if (loggedIn) {
      await Promise.all([
        recipesStore.fetchRecipes(),
        recipesStore.fetchSuggestions(),
      ]);
      recipesStore.subscribeSuggestionsRealtime();
    } else {
      recipesStore.unsubscribeSuggestionsRealtime();
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  recipesStore.unsubscribeSuggestionsRealtime();
});

function startNewRecipe() {
  activeSuggestion.value = null;
  draft.value = createEmptyRecipeDraft();
}

async function selectRecipe(id: string) {
  const full = await recipesStore.fetchRecipeById(id);
  if (!full) return;

  activeSuggestion.value = null;
  draft.value = {
    id: full.id,
    title: full.title,
    description: full.description ?? '',
    category: full.category,
    cover_url: full.cover_url,
    video_preview_url: full.video_preview_url,
    prep_time_min: full.prep_time_min,
    cook_time_min: full.cook_time_min,
    base_servings: full.base_servings,
    total_weight_g: full.total_weight_g,
    calories: full.calories,
    proteins: full.proteins,
    fats: full.fats,
    carbs: full.carbs,
    content_blocks: full.content_blocks ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    ingredients:
      full.ingredients.length > 0
        ? full.ingredients.map((ing) => ({
            localId: ing.id,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            is_scalable: ing.is_scalable,
            section_name: ing.section_name ?? null,
          }))
        : [
            {
              localId: crypto.randomUUID(),
              name: '',
              amount: null,
              unit: 'г',
              is_scalable: true,
              section_name: null,
            },
          ],
  };
}

function selectSuggestion(sug: RecipeSuggestion) {
  activeSuggestion.value = sug;

  const hasContentBlocks =
    sug.content_blocks &&
    Array.isArray(sug.content_blocks.content) &&
    sug.content_blocks.content.some(
      (n) => (n.content && n.content.length > 0) || Boolean(n.text),
    );

  const fallbackBlocks = sug.notes?.trim()
    ? {
        type: 'doc' as const,
        content: sug.notes
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
          })),
      }
    : { type: 'doc' as const, content: [{ type: 'paragraph' }] };

  draft.value = {
    id: undefined,
    title: sug.title,
    description: sug.notes?.trim() ?? '',
    category: sug.category || 'Основные блюда',
    cover_url: sug.cover_url ?? null,
    video_preview_url: null,
    prep_time_min: sug.prep_time_min ?? 15,
    cook_time_min: sug.cook_time_min ?? 30,
    base_servings: sug.base_servings || 4,
    total_weight_g: sug.total_weight_g ?? null,
    calories: sug.calories ?? null,
    proteins: sug.proteins ?? null,
    fats: sug.fats ?? null,
    carbs: sug.carbs ?? null,
    content_blocks: hasContentBlocks ? sug.content_blocks : fallbackBlocks,
    ingredients:
      Array.isArray(sug.ingredients) && sug.ingredients.length > 0
        ? sug.ingredients.map((ing) => ({
            localId: crypto.randomUUID(),
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit || 'г',
            is_scalable: ing.is_scalable ?? true,
            section_name: ing.section_name ?? null,
          }))
        : [
            {
              localId: crypto.randomUUID(),
              name: '',
              amount: null,
              unit: 'г',
              is_scalable: true,
              section_name: null,
            },
          ],
  };
}

async function handlePublishSuggestion() {
  if (!activeSuggestion.value) return;
  if (!draft.value.title.trim()) {
    recipesStore.error = 'Укажите название рецепта перед публикацией.';
    return;
  }

  const saved = await recipesStore.publishSuggestion(activeSuggestion.value.id, draft.value);
  if (saved) {
    activeSuggestion.value = null;
    await selectRecipe(saved.id);
    showToast('Предложенный рецепт опубликован в семейную книгу!');
  }
}

async function handleRejectSuggestion() {
  if (!activeSuggestion.value) return;
  const ok = await recipesStore.rejectSuggestion(activeSuggestion.value.id);
  if (ok) {
    activeSuggestion.value = null;
    startNewRecipe();
    showToast('Заявка отклонена');
  }
}

async function handleDeleteSuggestion() {
  if (!activeSuggestion.value) return;
  const ok = await recipesStore.deleteSuggestion(activeSuggestion.value.id);
  if (ok) {
    activeSuggestion.value = null;
    startNewRecipe();
    showToast('Заявка удалена');
  }
}

async function handleSave() {
  if (!draft.value.title.trim()) {
    recipesStore.error = 'Укажите название рецепта перед сохранением.';
    return;
  }

  const saved = await recipesStore.saveRecipe(draft.value);
  if (saved) {
    draft.value.id = saved.id;
    showToast('Рецепт успешно сохранён в семейную книгу');
  }
}

async function handleConfirmDelete() {
  if (!draft.value.id) return;
  const ok = await recipesStore.deleteRecipe(draft.value.id);
  deleteDialogOpen.value = false;
  if (ok) {
    startNewRecipe();
    showToast('Рецепт удалён');
  }
}

function handleFillSingleImport(imported: RecipeDraft) {
  draft.value = {
    ...imported,
    id: draft.value.id,
    cover_url: imported.cover_url ?? draft.value.cover_url,
    video_preview_url: imported.video_preview_url ?? draft.value.video_preview_url,
    ingredients:
      imported.ingredients.length > 0
        ? imported.ingredients
        : [
            {
              localId: crypto.randomUUID(),
              name: '',
              amount: null,
              unit: 'г',
              is_scalable: true,
              section_name: null,
            },
          ],
  };
  recipesStore.error = null;
  showToast('Поля рецепта заполнены — осталось добавить фото и сохранить');
}

function handleBatchImported(count: number) {
  showToast(`Успешно импортировано рецептов: ${count}`);
}
</script>

<template>
  <div v-if="auth.initializing" class="flex min-h-dvh items-center justify-center text-sm text-ink-secondary">
    Проверяем сессию...
  </div>

  <Transition name="fade" mode="out-in">
    <LoginView v-if="!auth.isAuthenticated" />

    <div v-else class="min-h-dvh pb-12">
      <!-- Верхняя панель -->
      <header class="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur-xl">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-[#FDF0D5] shadow-organic-sm">
              <img
                src="/mascot.png"
                alt="Пухня"
                class="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 class="font-display text-lg font-extrabold leading-tight text-ink">
                Пухня
              </h1>
              <p class="text-xs text-ink-secondary">
                Админка · {{ auth.user?.email }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              class="tactile inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-2 text-xs font-medium text-ink-secondary hover:text-ink"
              @click="auth.signOut()"
            >
              <LogOut class="h-3.5 w-3.5" aria-hidden="true" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Основной контейнер -->
      <main class="mx-auto mt-6 grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-12">
        <!-- Левый сайдбар со списком рецептов и заявок -->
        <div class="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 lg:h-[calc(100dvh-7.5rem)]">
          <RecipeSidebar
            :recipes="recipesStore.recipes"
            :suggestions="recipesStore.suggestions"
            :pending-suggestions-count="recipesStore.pendingSuggestionsCount"
            :selected-id="draft.id"
            :selected-suggestion-id="activeSuggestion?.id"
            :loading="recipesStore.loadingList"
            :loading-suggestions="recipesStore.loadingSuggestions"
            @select="selectRecipe"
            @select-suggestion="selectSuggestion"
            @create="startNewRecipe"
          />
        </div>

        <!-- Правая область: Конструктор рецепта -->
        <div class="space-y-5 lg:col-span-8 xl:col-span-9">
          <!-- Карточка просматриваемой заявки (если открыт предложенный рецепт) -->
          <div
            v-if="activeSuggestion"
            class="organic-card rounded-3xl border border-accent/30 bg-accent-soft/45 p-5 shadow-organic-sm"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-accent-contrast">
                    <Inbox class="h-3.5 w-3.5" aria-hidden="true" />
                    Заявка из приложения
                  </span>
                  <span v-if="activeSuggestion.author_name" class="text-xs font-semibold text-ink">
                    От: {{ activeSuggestion.author_name }}
                  </span>
                  <span class="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                    {{ activeSuggestion.mode === 'full' ? 'Полная форма' : 'Быстрая идея' }}
                  </span>
                </div>

                <p v-if="activeSuggestion.notes" class="pt-1 text-xs leading-relaxed text-ink-secondary">
                  {{ activeSuggestion.notes }}
                </p>

                <a
                  v-if="activeSuggestion.source_url"
                  :href="activeSuggestion.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-accent hover:underline"
                >
                  <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{{ activeSuggestion.source_url }}</span>
                </a>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="activeSuggestion.status === 'pending'"
                  type="button"
                  class="tactile inline-flex items-center gap-1.5 rounded-2xl border border-danger/25 bg-surface px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
                  @click="handleRejectSuggestion"
                >
                  <Ban class="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Отклонить</span>
                </button>
                <button
                  v-else
                  type="button"
                  class="tactile inline-flex items-center gap-1.5 rounded-2xl border border-danger/25 bg-surface px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
                  @click="handleDeleteSuggestion"
                >
                  <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Удалить заявку</span>
                </button>

                <button
                  type="button"
                  :disabled="recipesStore.saving"
                  class="tactile inline-flex items-center gap-1.5 rounded-2xl bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast shadow-organic-sm hover:bg-accent-hover disabled:opacity-60"
                  @click="handlePublishSuggestion"
                >
                  <Send class="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{{ recipesStore.saving ? 'Публикуем...' : 'Опубликовать в книгу' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Панель действий конструктора -->
          <div
            class="organic-card flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-hairline bg-surface px-5 py-4 shadow-organic-sm"
          >
            <div>
              <h2 class="font-display text-xl font-bold text-ink">
                {{
                  activeSuggestion
                    ? 'Дооформление предложенного рецепта'
                    : draft.id
                      ? 'Редактирование рецепта'
                      : 'Новый рецепт'
                }}
              </h2>
              <p class="text-xs text-ink-secondary">
                Изменения сразу доступны в мобильном приложении семьи.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                class="tactile inline-flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-xs font-semibold text-accent shadow-organic-sm hover:bg-accent hover:text-accent-contrast"
                @click="importOpen = true"
              >
                <Sparkles class="h-4 w-4" aria-hidden="true" />
                <span>Быстрый импорт (ИИ / Таблица)</span>
              </button>

              <button
                type="button"
                class="tactile inline-flex items-center gap-2 rounded-2xl border border-hairline bg-canvas px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted"
                @click="previewOpen = true"
              >
                <Smartphone class="h-4 w-4 text-accent" aria-hidden="true" />
                <span>Предпросмотр</span>
              </button>

              <button
                v-if="draft.id"
                type="button"
                class="tactile inline-flex items-center gap-1.5 rounded-2xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-xs font-semibold text-danger hover:bg-danger/15"
                @click="deleteDialogOpen = true"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
                <span>Удалить</span>
              </button>

              <button
                v-if="activeSuggestion"
                type="button"
                :disabled="recipesStore.saving"
                class="tactile inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-contrast shadow-organic-md hover:bg-accent-hover disabled:opacity-60"
                @click="handlePublishSuggestion"
              >
                <Send class="h-4 w-4" aria-hidden="true" />
                <span>{{ recipesStore.saving ? 'Публикуем...' : 'Опубликовать в книгу' }}</span>
              </button>

              <button
                v-else
                type="button"
                :disabled="recipesStore.saving"
                class="tactile inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-contrast shadow-organic-md hover:bg-accent-hover disabled:opacity-60"
                @click="handleSave"
              >
                <Save class="h-4 w-4" aria-hidden="true" />
                <span>{{ recipesStore.saving ? 'Сохраняем...' : 'Сохранить рецепт' }}</span>
              </button>
            </div>
          </div>

          <!-- Ошибки БД/валидации -->
          <div
            v-if="recipesStore.error"
            role="alert"
            class="rounded-3xl border border-danger/30 bg-danger/10 px-5 py-3.5 text-sm text-danger"
          >
            {{ recipesStore.error }}
          </div>

          <!-- Основные поля рецепта -->
          <section class="organic-card space-y-4 rounded-3xl border border-hairline bg-surface p-5 shadow-organic-sm">
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="sm:col-span-2">
                <label for="recipe-title" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  Название блюда *
                </label>
                <input
                  id="recipe-title"
                  v-model="draft.title"
                  type="text"
                  required
                  placeholder="Например: Домашний борщ с пампушками"
                  class="organic-input w-full rounded-2xl border border-hairline bg-canvas/70 px-4 py-3 font-display text-base font-bold text-ink placeholder:font-normal placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label for="recipe-category" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  Категория
                </label>
                <select
                  id="recipe-category"
                  v-model="draft.category"
                  class="w-full rounded-2xl border border-hairline bg-canvas/70 px-4 py-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
                >
                  <option v-for="cat in categoryOptions" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label for="recipe-desc" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Короткое описание / семейная история блюда
              </label>
              <textarea
                id="recipe-desc"
                v-model="draft.description"
                rows="2"
                placeholder="Пара тёплых слов об этом рецепте..."
                class="w-full resize-y rounded-2xl border border-hairline bg-canvas/70 px-4 py-3 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
              />
            </div>

            <MediaUploader
              v-model:cover-url="draft.cover_url"
              v-model:video-preview-url="draft.video_preview_url"
            />
          </section>

          <!-- Метрики и КБЖУ -->
          <NutritionFields
            v-model:prep-time-min="draft.prep_time_min"
            v-model:cook-time-min="draft.cook_time_min"
            v-model:base-servings="draft.base_servings"
            v-model:total-weight-g="draft.total_weight_g"
            v-model:calories="draft.calories"
            v-model:proteins="draft.proteins"
            v-model:fats="draft.fats"
            v-model:carbs="draft.carbs"
          />

          <!-- Ингредиенты -->
          <IngredientsBuilder v-model="draft.ingredients" />

          <!-- Блочный редактор TipTap -->
          <TipTapEditor v-model="draft.content_blocks" />
        </div>
      </main>

      <!-- Модальные окна -->
      <ImportRecipeModal
        :open="importOpen"
        @close="importOpen = false"
        @fill-single="handleFillSingleImport"
        @batch-imported="handleBatchImported"
      />

      <MobilePreviewModal
        :open="previewOpen"
        :draft="draft"
        @close="previewOpen = false"
      />

      <ConfirmDeleteDialog
        :open="deleteDialogOpen"
        :recipe-title="draft.title"
        :deleting="recipesStore.deleting"
        @cancel="deleteDialogOpen = false"
        @confirm="handleConfirmDelete"
      />

      <!-- Toast уведомление -->
      <Transition name="fade">
        <div
          v-if="toastMessage"
          role="status"
          class="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-contrast shadow-organic-lg"
        >
          <CheckCircle2 class="h-4 w-4" aria-hidden="true" />
          <span>{{ toastMessage }}</span>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
