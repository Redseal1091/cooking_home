import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RecipeWithIngredients, UserNote } from '@cookbook/shared';
import { supabase } from '@/lib/supabase';
import {
  cacheMediaUrls,
  extractMediaUrlsFromRecipes,
  getCachedRecipeNotes,
  getCachedRecipes,
  getOfflineQueue,
  pushOfflineQueue,
  setCachedRecipeNotes,
  setCachedRecipes,
  setOfflineQueue,
} from '@/lib/offlineCache';

export const useMobileRecipesStore = defineStore('mobile-recipes', () => {
  const recipes = ref<RecipeWithIngredients[]>([]);
  const loading = ref(false);
  const syncingMedia = ref(false);
  const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const cachedMediaCount = ref(0);
  const error = ref<string | null>(null);

  const notesByRecipe = ref<Record<string, UserNote[]>>({});

  /**
   * Уникальные названия ингредиентов по всей книге для подсказок в фильтре «Что есть дома».
   */
  const allIngredientNames = computed(() => {
    const freq = new Map<string, number>();
    for (const recipe of recipes.value) {
      for (const ing of recipe.ingredients) {
        const clean = ing.name.trim();
        if (!clean) continue;
        freq.set(clean, (freq.get(clean) ?? 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  });

  function updateOnlineStatus() {
    isOffline.value = !navigator.onLine;
    if (navigator.onLine) {
      void flushOfflineNotes();
      void fetchRecipes();
    }
  }

  async function loadInitial() {
    // 1. Мгновенно поднимаем кэш из @capacitor/preferences
    const cached = await getCachedRecipes();
    if (cached.length > 0) {
      recipes.value = cached;
    }

    // 2. Если есть сеть — синхронизируемся с Supabase
    if (navigator.onLine) {
      await flushOfflineNotes();
      await fetchRecipes();
    }
  }

  async function fetchRecipes() {
    if (!navigator.onLine) {
      isOffline.value = true;
      return;
    }

    loading.value = recipes.value.length === 0;
    error.value = null;

    try {
      const { data, error: dbErr } = await supabase
        .from('recipes')
        .select('*, ingredients(*)')
        .order('created_at', { ascending: false });

      if (dbErr) throw dbErr;

      const normalized: RecipeWithIngredients[] = (data ?? []).map((row) => ({
        ...(row as RecipeWithIngredients),
        ingredients: [...((row as RecipeWithIngredients).ingredients ?? [])].sort(
          (a, b) => a.order_index - b.order_index,
        ),
      }));

      recipes.value = normalized;
      isOffline.value = false;
      await setCachedRecipes(normalized);

      // В фоне кэшируем фото обложек и шагов для офлайна
      void precacheAllMedia(normalized);
    } catch (err) {
      isOffline.value = !navigator.onLine;
      if (recipes.value.length === 0) {
        error.value = err instanceof Error ? err.message : 'Не удалось загрузить рецепты';
      }
    } finally {
      loading.value = false;
    }
  }

  async function precacheAllMedia(list: RecipeWithIngredients[] = recipes.value) {
    if (!navigator.onLine) return;
    syncingMedia.value = true;
    try {
      const urls = extractMediaUrlsFromRecipes(list);
      cachedMediaCount.value = await cacheMediaUrls(urls);
    } finally {
      syncingMedia.value = false;
    }
  }

  async function fetchNotes(recipeId: string) {
    const cached = await getCachedRecipeNotes(recipeId);
    if (cached.length > 0) {
      notesByRecipe.value[recipeId] = cached;
    }

    if (!navigator.onLine) return;

    try {
      const { data, error: dbErr } = await supabase
        .from('user_notes')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });

      if (dbErr) throw dbErr;
      const list = (data ?? []) as UserNote[];
      notesByRecipe.value[recipeId] = list;
      await setCachedRecipeNotes(recipeId, list);
    } catch {
      // Оставляем кэш
    }
  }

  async function addNote(recipeId: string, noteText: string): Promise<boolean> {
    const clean = noteText.trim();
    if (!clean) return false;

    const optimistic: UserNote = {
      id: `local-${Date.now()}`,
      recipe_id: recipeId,
      note_text: clean,
      created_at: new Date().toISOString(),
    };

    const current = notesByRecipe.value[recipeId] ?? [];
    notesByRecipe.value[recipeId] = [optimistic, ...current];
    await setCachedRecipeNotes(recipeId, notesByRecipe.value[recipeId]);

    if (!navigator.onLine) {
      await pushOfflineQueue({
        id: optimistic.id,
        type: 'add_note',
        recipe_id: recipeId,
        note_text: clean,
        created_at: optimistic.created_at,
      });
      return true;
    }

    try {
      const { data, error: dbErr } = await supabase
        .from('user_notes')
        .insert({ recipe_id: recipeId, note_text: clean })
        .select()
        .single();

      if (dbErr) throw dbErr;

      notesByRecipe.value[recipeId] = [
        data as UserNote,
        ...notesByRecipe.value[recipeId].filter((n) => n.id !== optimistic.id),
      ];
      await setCachedRecipeNotes(recipeId, notesByRecipe.value[recipeId]);
      return true;
    } catch {
      await pushOfflineQueue({
        id: optimistic.id,
        type: 'add_note',
        recipe_id: recipeId,
        note_text: clean,
        created_at: optimistic.created_at,
      });
      return true;
    }
  }

  async function flushOfflineNotes() {
    const queue = await getOfflineQueue();
    const noteActions = queue.filter((q) => q.type === 'add_note');
    if (noteActions.length === 0) return;

    const remaining: typeof queue = queue.filter((q) => q.type !== 'add_note');
    for (const action of noteActions) {
      if (action.type !== 'add_note') continue;
      try {
        await supabase.from('user_notes').insert({
          recipe_id: action.recipe_id,
          note_text: action.note_text,
        });
      } catch {
        remaining.push(action);
      }
    }
    await setOfflineQueue(remaining);
  }

  return {
    recipes,
    loading,
    syncingMedia,
    isOffline,
    cachedMediaCount,
    error,
    notesByRecipe,
    allIngredientNames,
    updateOnlineStatus,
    loadInitial,
    fetchRecipes,
    precacheAllMedia,
    fetchNotes,
    addNote,
  };
});
