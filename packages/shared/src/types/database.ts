export type RecipeCategory =
  | 'Завтраки'
  | 'Основные блюда'
  | 'Супы'
  | 'Салаты'
  | 'Выпечка'
  | 'Десерты'
  | 'Закуски'
  | 'Напитки'
  | 'Соусы'
  | string;

export const DEFAULT_RECIPE_CATEGORIES: readonly string[] = [
  'Завтраки',
  'Основные блюда',
  'Супы',
  'Салаты',
  'Выпечка',
  'Десерты',
  'Закуски',
  'Напитки',
  'Соусы',
] as const;

export const INGREDIENT_UNITS: readonly string[] = [
  'г',
  'кг',
  'мл',
  'л',
  'шт',
  'ст.л.',
  'ч.л.',
  'стакан',
  'щепотка',
  'зубч.',
  'по вкусу',
] as const;

export const DEFAULT_INGREDIENT_SECTIONS: readonly string[] = [
  'Для теста',
  'Для начинки',
  'Для соуса',
  'Для крема',
  'Для маринада',
  'Для подачи',
] as const;

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  category: RecipeCategory;
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
  created_at: string;
  updated_at?: string;
}

export interface Ingredient {
  id: string;
  recipe_id: string;
  name: string;
  amount: number | null;
  unit: string;
  is_scalable: boolean;
  order_index: number;
  section_name?: string | null;
}

export type SuggestionStatus = 'pending' | 'published' | 'rejected';
export type SuggestionMode = 'quick' | 'full';

export interface SuggestedIngredientInput {
  name: string;
  amount: number | null;
  unit: string;
  is_scalable: boolean;
  section_name?: string | null;
}

export interface RecipeSuggestion {
  id: string;
  status: SuggestionStatus;
  mode: SuggestionMode;
  title: string;
  notes: string | null;
  source_url: string | null;
  author_name: string | null;
  category: RecipeCategory;
  cover_url: string | null;
  prep_time_min: number;
  cook_time_min: number;
  base_servings: number;
  total_weight_g: number | null;
  calories: number | null;
  proteins: number | null;
  fats: number | null;
  carbs: number | null;
  ingredients: SuggestedIngredientInput[];
  content_blocks: TipTapDocument;
  published_recipe_id: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ShoppingListItem {
  id: string;
  product_name: string;
  amount: number;
  unit: string;
  is_checked: boolean;
  recipe_title: string | null;
  created_at?: string;
}

export interface UserNote {
  id: string;
  recipe_id: string;
  note_text: string;
  created_at: string;
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: Ingredient[];
}

export interface RecipeFull extends RecipeWithIngredients {
  user_notes: UserNote[];
}

export interface ScaledIngredient extends Ingredient {
  scaledAmount: number | null;
  formattedAmount: string;
}

export interface IngredientSectionGroup {
  sectionName: string | null;
  items: ScaledIngredient[];
}

export interface NutritionPerServing {
  calories: number | null;
  proteins: number | null;
  fats: number | null;
  carbs: number | null;
  weightPerServing: number | null;
}

export interface ParsedTimeToken {
  raw: string;
  seconds: number;
  label: string;
  startIndex: number;
  endIndex: number;
}
