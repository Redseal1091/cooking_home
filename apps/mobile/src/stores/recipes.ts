import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { normalizeIngredient, type RecipeWithIngredients, type UserNote } from '@cookbook/shared';
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
   * Уникальные очищенные названия ингредиентов по всей книге для подсказок в фильтре «Что есть дома».
   */
  const allIngredientNames = computed(() => {
    const freq = new Map<string, { label: string; count: number }>();
    for (const recipe of recipes.value) {
      const seenInRecipe = new Set<string>();
      for (const ing of recipe.ingredients) {
        const clean = normalizeIngredient(ing.name).name;
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (seenInRecipe.has(key)) continue;
        seenInRecipe.add(key);

        const prev = freq.get(key);
        const prettyLabel = clean.charAt(0).toUpperCase() + clean.slice(1);
        if (prev) {
          prev.count += 1;
        } else {
          freq.set(key, { label: prettyLabel, count: 1 });
        }
      }
    }
    return Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .map((item) => item.label);
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

  async function deleteNote(recipeId: string, noteId: string): Promise<boolean> {
    const current = notesByRecipe.value[recipeId] ?? [];
    notesByRecipe.value[recipeId] = current.filter((n) => n.id !== noteId);
    await setCachedRecipeNotes(recipeId, notesByRecipe.value[recipeId]);

    if (noteId.startsWith('local-')) {
      const queue = await getOfflineQueue();
      const filtered = queue.filter((q) => !(q.type === 'add_note' && q.id === noteId));
      if (filtered.length !== queue.length) {
        await setOfflineQueue(filtered);
      }
      return true;
    }

    if (!navigator.onLine) {
      await pushOfflineQueue({
        id: `del-note-${noteId}`,
        type: 'delete_note',
        note_id: noteId,
      });
      return true;
    }

    try {
      const { error: dbErr } = await supabase.from('user_notes').delete().eq('id', noteId);
      if (dbErr) throw dbErr;
      return true;
    } catch {
      await pushOfflineQueue({
        id: `del-note-${noteId}`,
        type: 'delete_note',
        note_id: noteId,
      });
      return true;
    }
  }

  async function flushOfflineNotes() {
    const queue = await getOfflineQueue();
    const noteActions = queue.filter((q) => q.type === 'add_note' || q.type === 'delete_note');
    if (noteActions.length === 0) return;

    const remaining: typeof queue = queue.filter(
      (q) => q.type !== 'add_note' && q.type !== 'delete_note',
    );
    for (const action of noteActions) {
      try {
        if (action.type === 'add_note') {
          const { error: dbErr } = await supabase.from('user_notes').insert({
            recipe_id: action.recipe_id,
            note_text: action.note_text,
          });
          if (dbErr) throw dbErr;
        } else if (action.type === 'delete_note') {
          const { error: dbErr } = await supabase
            .from('user_notes')
            .delete()
            .eq('id', action.note_id);
          if (dbErr) throw dbErr;
        }
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
    deleteNote,
  };
});
