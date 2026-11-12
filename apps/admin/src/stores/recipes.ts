import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Recipe, RecipeWithIngredients, TipTapDocument } from '@cookbook/shared';
import { supabase } from '@/lib/supabase';

export interface IngredientDraft {
  localId: string;
  name: string;
  amount: number | null;
  unit: string;
  is_scalable: boolean;
}

export interface RecipeDraft {
  id?: string;
  title: string;
  description: string;
  category: string;
  cover_url: string | null;
  video_preview_url: string | null;
  prep_time_min: number;
  cook_time_min: number;
  base_servings: number;
  total_weight_g: number | null;
  calories: number | null;
  proteins: number | null;
  fats: number | null;
  carbs: number | null;
  content_blocks: TipTapDocument;
  ingredients: IngredientDraft[];
}

export function createEmptyRecipeDraft(): RecipeDraft {
  return {
    title: '',
    description: '',
    category: 'Основные блюда',
    cover_url: null,
    video_preview_url: null,
    prep_time_min: 15,
    cook_time_min: 30,
    base_servings: 4,
    total_weight_g: null,
    calories: null,
    proteins: null,
    fats: null,
    carbs: null,
    content_blocks: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    },
    ingredients: [
      {
        localId: crypto.randomUUID(),
        name: '',
        amount: null,
        unit: 'г',
        is_scalable: true,
      },
    ],
  };
}

export const useRecipesStore = defineStore('recipes', () => {
  const recipes = ref<Recipe[]>([]);
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const error = ref<string | null>(null);

  async function fetchRecipes() {
    loadingList.value = true;
    error.value = null;
    try {
      const { data, error: dbError } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      recipes.value = (data ?? []) as Recipe[];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить рецепты';
    } finally {
      loadingList.value = false;
    }
  }

  async function fetchRecipeById(id: string): Promise<RecipeWithIngredients | null> {
    loadingDetail.value = true;
    error.value = null;
    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (recipeError) throw recipeError;

      const { data: ingData, error: ingError } = await supabase
        .from('ingredients')
        .select('*')
        .eq('recipe_id', id)
        .order('order_index', { ascending: true });

      if (ingError) throw ingError;

      return {
        ...(recipeData as Recipe),
        ingredients: ingData ?? [],
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить рецепт';
      return null;
    } finally {
      loadingDetail.value = false;
    }
  }

  async function saveRecipeInternal(draft: RecipeDraft): Promise<Recipe> {
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      category: draft.category.trim() || 'Основные блюда',
      cover_url: draft.cover_url || null,
      video_preview_url: draft.video_preview_url || null,
      prep_time_min: Math.max(0, Number(draft.prep_time_min) || 0),
      cook_time_min: Math.max(0, Number(draft.cook_time_min) || 0),
      base_servings: Math.max(1, Number(draft.base_servings) || 1),
      total_weight_g:
        draft.total_weight_g && draft.total_weight_g > 0
          ? Math.round(draft.total_weight_g)
          : null,
      calories: draft.calories !== null && draft.calories >= 0 ? draft.calories : null,
      proteins: draft.proteins !== null && draft.proteins >= 0 ? draft.proteins : null,
      fats: draft.fats !== null && draft.fats >= 0 ? draft.fats : null,
      carbs: draft.carbs !== null && draft.carbs >= 0 ? draft.carbs : null,
      content_blocks: draft.content_blocks,
    };

    let savedRecipe: Recipe;

    if (draft.id) {
      const { data, error: updateErr } = await supabase
        .from('recipes')
        .update(payload)
        .eq('id', draft.id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      savedRecipe = data as Recipe;

      const { error: delIngErr } = await supabase
        .from('ingredients')
        .delete()
        .eq('recipe_id', savedRecipe.id);

      if (delIngErr) throw delIngErr;
    } else {
      const { data, error: insertErr } = await supabase
        .from('recipes')
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;
      savedRecipe = data as Recipe;
    }

    const validIngredients = draft.ingredients
      .filter((ing) => ing.name.trim().length > 0)
      .map((ing, index) => ({
        recipe_id: savedRecipe.id,
        name: ing.name.trim(),
        amount: ing.amount !== null && !Number.isNaN(ing.amount) ? Number(ing.amount) : null,
        unit: ing.unit.trim() || 'г',
        is_scalable: ing.is_scalable,
        order_index: index,
      }));

    if (validIngredients.length > 0) {
      const { error: ingInsertErr } = await supabase
        .from('ingredients')
        .insert(validIngredients);

      if (ingInsertErr) throw ingInsertErr;
    }

    return savedRecipe;
  }

  async function saveRecipe(draft: RecipeDraft): Promise<Recipe | null> {
    saving.value = true;
    error.value = null;

    try {
      const savedRecipe = await saveRecipeInternal(draft);
      await fetchRecipes();
      return savedRecipe;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось сохранить рецепт';
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function importRecipesBatch(
    drafts: RecipeDraft[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<number> {
    saving.value = true;
    error.value = null;
    let importedCount = 0;

    try {
      for (let i = 0; i < drafts.length; i++) {
        await saveRecipeInternal(drafts[i]);
        importedCount++;
        onProgress?.(importedCount, drafts.length);
      }
      await fetchRecipes();
      return importedCount;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка пакетного импорта рецептов';
      await fetchRecipes();
      return importedCount;
    } finally {
      saving.value = false;
    }
  }

  async function deleteRecipe(id: string): Promise<boolean> {
    deleting.value = true;
    error.value = null;
    try {
      const { error: delErr } = await supabase.from('recipes').delete().eq('id', id);
      if (delErr) throw delErr;
      recipes.value = recipes.value.filter((r) => r.id !== id);
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось удалить рецепт';
      return false;
    } finally {
      deleting.value = false;
    }
  }

  return {
    recipes,
    loadingList,
    loadingDetail,
    saving,
    deleting,
    error,
    fetchRecipes,
    fetchRecipeById,
    saveRecipe,
    importRecipesBatch,
    deleteRecipe,
  };
});
