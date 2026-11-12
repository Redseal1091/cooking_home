import type {
  Ingredient,
  NutritionPerServing,
  ParsedTimeToken,
  Recipe,
  ScaledIngredient,
} from '../types/database';

/**
 * Рассчитывает коэффициент масштабирования от нового количества порций.
 */
export function getScaleFactorByServings(baseServings: number, targetServings: number): number {
  if (baseServings <= 0 || targetServings <= 0) return 1;
  return targetServings / baseServings;
}

/**
 * Обратный калькулятор (от остатков):
 * рассчитывает коэффициент масштабирования исходя из имеющегося у пользователя
 * количества конкретного ингредиента.
 */
export function getScaleFactorByIngredient(
  baseAmount: number | null,
  availableAmount: number,
): number {
  if (!baseAmount || baseAmount <= 0 || availableAmount <= 0) return 1;
  return availableAmount / baseAmount;
}

/**
 * Округляет масштабированное количество с учётом единицы измерения,
 * чтобы избежать некрасивых значений вроде "133.3333 г" или "1.999 шт".
 */
export function roundIngredientAmount(value: number, unit: string): number {
  const normalizedUnit = unit.trim().toLowerCase();

  if (normalizedUnit === 'г' || normalizedUnit === 'мл') {
    if (value >= 100) return Math.round(value);
    if (value >= 10) return Math.round(value * 2) / 2;
    return Math.round(value * 10) / 10;
  }

  if (
    normalizedUnit === 'шт' ||
    normalizedUnit === 'зубч.' ||
    normalizedUnit === 'ст.л.' ||
    normalizedUnit === 'ч.л.' ||
    normalizedUnit === 'стакан'
  ) {
    // Округление до 0.25 (четверти ложки/штуки) для малых величин
    if (value < 5) {
      return Math.round(value * 4) / 4;
    }
    return Math.round(value * 2) / 2;
  }

  return Math.round(value * 100) / 100;
}

/**
 * Красиво форматирует число для UI (заменяет .25/.5/.75 на понятные дроби или убирает лишние нули).
 */
export function formatAmount(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toString().replace('.', ',');
}

/**
 * Масштабирует список ингредиентов по заданному коэффициенту.
 * Ингредиенты с `is_scalable = false` (соль, перец, специи по вкусу) не изменяются.
 */
export function scaleIngredients(
  ingredients: Ingredient[],
  scaleFactor: number,
): ScaledIngredient[] {
  const safeFactor = scaleFactor > 0 ? scaleFactor : 1;

  return [...ingredients]
    .sort((a, b) => a.order_index - b.order_index)
    .map((item) => {
      if (item.amount === null) {
        return {
          ...item,
          scaledAmount: null,
          formattedAmount: '',
        };
      }

      if (!item.is_scalable) {
        return {
          ...item,
          scaledAmount: item.amount,
          formattedAmount: formatAmount(item.amount),
        };
      }

      const rawScaled = item.amount * safeFactor;
      const rounded = roundIngredientAmount(rawScaled, item.unit);

      return {
        ...item,
        scaledAmount: rounded,
        formattedAmount: formatAmount(rounded),
      };
    });
}

/**
 * Рассчитывает КБЖУ на 1 порцию.
 * В БД поля calories, proteins, fats, carbs хранят значения на весь рецепт (или базовый выход).
 * При пересчёте на 1 порцию делим на `base_servings`.
 */
export function calculateNutritionPerServing(
  recipe: Pick<
    Recipe,
    'base_servings' | 'total_weight_g' | 'calories' | 'proteins' | 'fats' | 'carbs'
  >,
): NutritionPerServing {
  const servings = recipe.base_servings > 0 ? recipe.base_servings : 1;

  const perServing = (total: number | null): number | null => {
    if (total === null || total === undefined) return null;
    return Math.round((total / servings) * 10) / 10;
  };

  return {
    calories: recipe.calories !== null ? Math.round(recipe.calories / servings) : null,
    proteins: perServing(recipe.proteins),
    fats: perServing(recipe.fats),
    carbs: perServing(recipe.carbs),
    weightPerServing:
      recipe.total_weight_g !== null ? Math.round(recipe.total_weight_g / servings) : null,
  };
}

/**
 * Рассчитывает суммарный КБЖУ для текущего масштаба (на все выбранные порции).
 */
export function calculateScaledTotalNutrition(
  recipe: Pick<Recipe, 'total_weight_g' | 'calories' | 'proteins' | 'fats' | 'carbs'>,
  scaleFactor: number,
): NutritionPerServing {
  const factor = scaleFactor > 0 ? scaleFactor : 1;

  const scaleVal = (val: number | null): number | null => {
    if (val === null || val === undefined) return null;
    return Math.round(val * factor * 10) / 10;
  };

  return {
    calories: recipe.calories !== null ? Math.round(recipe.calories * factor) : null,
    proteins: scaleVal(recipe.proteins),
    fats: scaleVal(recipe.fats),
    carbs: scaleVal(recipe.carbs),
    weightPerServing:
      recipe.total_weight_g !== null ? Math.round(recipe.total_weight_g * factor) : null,
  };
}

/**
 * Парсер упоминаний времени в тексте шага рецепта.
 * Находит выражения вроде "15 мин", "45 минут", "1 час", "1,5 часа", "30 сек", "2 ч".
 */
const TIME_PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(час(?:а|ов)?|ч\.?|минут(?:ы|у)?|мин\.?|секунд(?:ы|у)?|сек\.?)(?![а-яА-ЯёЁa-zA-Z])/gi;

export function parseTimeTokens(text: string): ParsedTimeToken[] {
  const tokens: ParsedTimeToken[] = [];
  if (!text) return tokens;

  TIME_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TIME_PATTERN.exec(text)) !== null) {
    const numericPart = Number.parseFloat(match[1].replace(',', '.'));
    if (Number.isNaN(numericPart) || numericPart <= 0) continue;

    const unitRaw = match[2].toLowerCase();
    let multiplierSeconds = 60;

    if (unitRaw.startsWith('ч')) {
      multiplierSeconds = 3600;
    } else if (unitRaw.startsWith('с')) {
      multiplierSeconds = 1;
    }

    const totalSeconds = Math.round(numericPart * multiplierSeconds);
    if (totalSeconds <= 0) continue;

    tokens.push({
      raw: match[0],
      seconds: totalSeconds,
      label: match[0].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return tokens;
}

/**
 * Форматирует секунды в мм:сс или ч:мм:сс для встроенного таймера.
 */
export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
