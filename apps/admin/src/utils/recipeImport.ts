import {
  DEFAULT_RECIPE_CATEGORIES,
  INGREDIENT_UNITS,
  type TipTapDocument,
  type TipTapNode,
} from '@cookbook/shared';
import type { IngredientDraft, RecipeDraft } from '@/stores/recipes';

export const AI_PROMPT_TEMPLATE = `Ты — опытный шеф-повар и нутрициолог. Сформируй рецепт (или массив из нескольких рецептов) строго в формате JSON без пояснений вокруг.

Используй следующую структуру:
{
  "title": "Название блюда",
  "category": "Одна из: ${DEFAULT_RECIPE_CATEGORIES.join(', ')}",
  "description": "Короткое уютное описание блюда (1–2 предложения)",
  "prep_time_min": 15,
  "cook_time_min": 30,
  "base_servings": 4,
  "total_weight_g": 1200,
  "calories": 1850,
  "proteins": 110,
  "fats": 75,
  "carbs": 180,
  "ingredients": [
    { "name": "Куриное филе", "amount": 500, "unit": "г", "is_scalable": true },
    { "name": "Соль", "amount": 1, "unit": "по вкусу", "is_scalable": false }
  ],
  "steps": [
    "Нарежьте куриное филе кубиками и обжарьте 7 мин на среднем огне.",
    "Добавьте соус и тушите под крышкой ещё 15 минут до готовности."
  ]
}

Правила:
1. КБЖУ (calories, proteins, fats, carbs) указывай СУММАРНО на весь рецепт (на все base_servings порций).
2. Доступные единицы unit: ${INGREDIENT_UNITS.join(', ')}.
3. Для соли, перца и специй по вкусу ставь "is_scalable": false.
4. В тексте шагов пиши время в формате «10 мин», «45 минут», «1 час» — они автоматически станут таймерами.

Блюдо для генерации: [НАПИШИТЕ ЗДЕСЬ НАЗВАНИЕ ИЛИ ПРОДУКТЫ]`;

export const CSV_EXAMPLE_CONTENT = `\uFEFFtitle;category;description;prep_time_min;cook_time_min;base_servings;total_weight_g;calories;proteins;fats;carbs;ingredients_list;steps_list
Курица терияки с рисом;Основные блюда;Сочная курица в домашнем соусе терияки с рассыпчатым рисом;15;25;4;1100;1920;132;54;215;Курица:400:г:true | Рис басмати:250:г:true | Соевый соус:60:мл:true | Соль:1:по вкусу:false;Промойте рис и варите 15 мин под крышкой. | Нарежьте курицу и обжарьте 8 мин на сильном огне. | Влейте соус и тушите 5 мин до загустения.
Сырники творожные классические;Завтраки;Нежные румяные сырники с ванилью на семейный завтрак;10;15;3;650;1240;78;46;125;Творог 5%:500:г:true | Яйцо:1:шт:true | Мука:3:ст.л.:true | Сахар:2:ст.л.:true | Соль:1:щепотка:false;Смешайте творог, яйцо, сахар и соль до однородности. | Сформируйте сырники и обваляйте в муке. | Жарьте по 4 мин с каждой стороны на слабом огне.`;

interface RawIngredientInput {
  name?: unknown;
  amount?: unknown;
  unit?: unknown;
  is_scalable?: unknown;
}

interface RawRecipeInput {
  title?: unknown;
  category?: unknown;
  description?: unknown;
  cover_url?: unknown;
  video_preview_url?: unknown;
  prep_time_min?: unknown;
  cook_time_min?: unknown;
  base_servings?: unknown;
  total_weight_g?: unknown;
  calories?: unknown;
  proteins?: unknown;
  fats?: unknown;
  carbs?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  content_blocks?: unknown;
}

function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num =
    typeof val === 'number'
      ? val
      : Number.parseFloat(String(val).trim().replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

function toInt(val: unknown, fallback: number, min = 0): number {
  const num = toNumberOrNull(val);
  if (num === null) return fallback;
  return Math.max(min, Math.round(num));
}

function toBoolean(val: unknown, fallback = true): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const clean = val.trim().toLowerCase();
    if (clean === 'false' || clean === '0' || clean === 'нет') return false;
    if (clean === 'true' || clean === '1' || clean === 'да') return true;
  }
  return fallback;
}

/**
 * Конвертирует массив текстовых шагов `steps: string[]` в TipTap JSONB документ.
 */
export function stepsArrayToTipTapDoc(steps: string[]): TipTapDocument {
  const cleanSteps = steps
    .map((s) => s.trim().replace(/^\d+[.)]\s+/, ''))
    .filter((s) => s.length > 0);

  if (cleanSteps.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const listItems: TipTapNode[] = cleanSteps.map((stepText) => ({
    type: 'listItem',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: stepText }],
      },
    ],
  }));

  return {
    type: 'doc',
    content: [
      {
        type: 'orderedList',
        content: listItems,
      },
    ],
  };
}

function normalizeRecipeObject(raw: RawRecipeInput): RecipeDraft {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    throw new Error('В одном из рецептов отсутствует обязательное поле "title".');
  }

  const ingredientsRaw = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients: IngredientDraft[] = ingredientsRaw
    .map((item): IngredientDraft | null => {
      const ing = item as RawIngredientInput;
      const name = typeof ing?.name === 'string' ? ing.name.trim() : '';
      if (!name) return null;
      return {
        localId: crypto.randomUUID(),
        name,
        amount: toNumberOrNull(ing.amount),
        unit: typeof ing.unit === 'string' && ing.unit.trim() ? ing.unit.trim() : 'г',
        is_scalable: toBoolean(ing.is_scalable, true),
      };
    })
    .filter((i): i is IngredientDraft => i !== null);

  let contentBlocks: TipTapDocument;
  if (
    raw.content_blocks &&
    typeof raw.content_blocks === 'object' &&
    (raw.content_blocks as TipTapDocument).type === 'doc'
  ) {
    contentBlocks = raw.content_blocks as TipTapDocument;
  } else if (Array.isArray(raw.steps)) {
    contentBlocks = stepsArrayToTipTapDoc(raw.steps.map((s) => String(s ?? '')));
  } else if (typeof raw.steps === 'string') {
    contentBlocks = stepsArrayToTipTapDoc(raw.steps.split(/\r?\n|\|/));
  } else {
    contentBlocks = { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  return {
    title,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    category:
      typeof raw.category === 'string' && raw.category.trim()
        ? raw.category.trim()
        : 'Основные блюда',
    cover_url: typeof raw.cover_url === 'string' && raw.cover_url.trim() ? raw.cover_url.trim() : null,
    video_preview_url:
      typeof raw.video_preview_url === 'string' && raw.video_preview_url.trim()
        ? raw.video_preview_url.trim()
        : null,
    prep_time_min: toInt(raw.prep_time_min, 15, 0),
    cook_time_min: toInt(raw.cook_time_min, 30, 0),
    base_servings: toInt(raw.base_servings, 4, 1),
    total_weight_g: toNumberOrNull(raw.total_weight_g),
    calories: toNumberOrNull(raw.calories),
    proteins: toNumberOrNull(raw.proteins),
    fats: toNumberOrNull(raw.fats),
    carbs: toNumberOrNull(raw.carbs),
    content_blocks: contentBlocks,
    ingredients,
  };
}

/**
 * Парсит JSON-текст от ИИ (очищает markdown-блоки ```json ... ```),
 * поддерживая как одиночный объект, так и массив рецептов.
 */
export function parseRecipesFromJsonText(rawText: string): RecipeDraft[] {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('Вставьте JSON-текст рецепта.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Некорректный JSON. Проверьте синтаксис (кавычки, запятые, скобки).');
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('Массив рецептов пуст.');
    }
    return parsed.map((item) => normalizeRecipeObject(item as RawRecipeInput));
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.recipes)) {
      if (obj.recipes.length === 0) {
        throw new Error('Массив "recipes" пуст.');
      }
      return obj.recipes.map((item) => normalizeRecipeObject(item as RawRecipeInput));
    }
    return [normalizeRecipeObject(obj as RawRecipeInput)];
  }

  throw new Error('Ожидается JSON-объект рецепта или массив рецептов.');
}

/**
 * Разбирает CSV-строку с учётом кавычек и разделителя `;`.
 */
function parseCsvRows(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, '').trim();
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ';') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Парсит CSV с разделителем `;` и колонками:
 * title;category;description;prep_time_min;cook_time_min;base_servings;total_weight_g;calories;proteins;fats;carbs;ingredients_list;steps_list
 */
export function parseRecipesFromCsvText(csvText: string): RecipeDraft[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('CSV-файл должен содержать строку заголовков и хотя бы одну строку с рецептом.');
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const titleIdx = headers.indexOf('title');
  if (titleIdx === -1) {
    throw new Error('В CSV не найдена обязательная колонка "title". Разделитель колонок должен быть ";".');
  }

  const drafts: RecipeDraft[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const getCell = (name: string): string => {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < row.length ? row[idx] : '';
    };

    const title = getCell('title');
    if (!title) continue;

    const ingRaw = getCell('ingredients_list');
    const ingredients: IngredientDraft[] = ingRaw
      ? ingRaw
          .split(/[|;]/)
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .map((chunk): IngredientDraft | null => {
            const parts = chunk.split(':').map((p) => p.trim());
            const name = parts[0] ?? '';
            if (!name) return null;
            const amount = parts[1] !== undefined ? toNumberOrNull(parts[1]) : null;
            const unit = parts[2] || 'г';
            const isScalable = parts[3] !== undefined ? toBoolean(parts[3], true) : true;
            return {
              localId: crypto.randomUUID(),
              name,
              amount,
              unit,
              is_scalable: isScalable,
            };
          })
          .filter((i): i is IngredientDraft => i !== null)
      : [];

    const stepsRaw = getCell('steps_list');
    const stepsArray = stepsRaw
      ? stepsRaw.split('|').map((s) => s.trim()).filter(Boolean)
      : [];

    drafts.push({
      title,
      category: getCell('category') || 'Основные блюда',
      description: getCell('description') || '',
      cover_url: null,
      video_preview_url: null,
      prep_time_min: toInt(getCell('prep_time_min'), 15, 0),
      cook_time_min: toInt(getCell('cook_time_min'), 30, 0),
      base_servings: toInt(getCell('base_servings'), 4, 1),
      total_weight_g: toNumberOrNull(getCell('total_weight_g')),
      calories: toNumberOrNull(getCell('calories')),
      proteins: toNumberOrNull(getCell('proteins')),
      fats: toNumberOrNull(getCell('fats')),
      carbs: toNumberOrNull(getCell('carbs')),
      content_blocks: stepsArrayToTipTapDoc(stepsArray),
      ingredients,
    });
  }

  if (drafts.length === 0) {
    throw new Error('В CSV-файле не найдено ни одного корректного рецепта.');
  }

  return drafts;
}

export function downloadCsvExampleFile() {
  const blob = new Blob([CSV_EXAMPLE_CONTENT], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'recipes-import-example.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
