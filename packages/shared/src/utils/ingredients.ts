export interface NormalizedIngredientResult {
  name: string;
  section_name: string | null;
}

const SECTION_DIRECT_MAP: Array<[RegExp, string]> = [
  [/^(?:для\s+теста|в\s+тесто|на\s+тесто)$/i, 'Для теста'],
  [/^(?:для\s+начинки|в\s+начинку|на\s+начинку)$/i, 'Для начинки'],
  [/^(?:для\s+соуса|в\s+соус|на\s+соус)$/i, 'Для соуса'],
  [/^(?:для\s+подачи|к\s+подаче|на\s+подачу|при\s+подаче)$/i, 'Для подачи'],
  [/^(?:для\s+крема|в\s+крем|на\s+крем)$/i, 'Для крема'],
  [/^(?:для\s+маринада|в\s+маринад|для\s+маринования)$/i, 'Для маринада'],
  [/^(?:для\s+заправки|в\s+заправку)$/i, 'Для заправки'],
  [/^(?:для\s+глазури|в\s+глазурь)$/i, 'Для глазури'],
  [/^(?:для\s+посыпки|для\s+украшения|на\s+украшение)$/i, 'Для украшения'],
  [/^(?:для\s+фарша|в\s+фарш)$/i, 'Для фарша'],
  [/^(?:для\s+основы|в\s+основу)$/i, 'Для основы'],
  [/^(?:для\s+заливки|в\s+заливку)$/i, 'Для заливки'],
  [/^(?:для\s+сиропа|в\s+сироп)$/i, 'Для сиропа'],
  [/^(?:для\s+бульона|в\s+бульон)$/i, 'Для бульона'],
  [/^(?:для\s+панировки|в\s+панировку)$/i, 'Для панировки'],
  [/^(?:для\s+обжарки|для\s+жарки|для\s+смазывания)$/i, 'Для обжарки'],
];

const GENERAL_PURPOSE_REGEX =
  /^(?:для|к|при)\s+[а-яёa-z][а-яёa-z0-9\s-]{1,32}$/i;

function extractPurposeSection(note: string): string | null {
  const clean = note.trim().replace(/\s{2,}/g, ' ');
  if (!clean) return null;

  for (const [pattern, normalizedLabel] of SECTION_DIRECT_MAP) {
    if (pattern.test(clean)) {
      return normalizedLabel;
    }
  }

  if (GENERAL_PURPOSE_REGEX.test(clean)) {
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  return null;
}

/**
 * Очищает название ингредиента от скобок `(...)` и лишних пробелов.
 * Если текст в скобках обозначает назначение («в тесто», «для начинки» и т.д.)
 * и `currentSection` ещё не задана — автоматически переносит его в `section_name`.
 */
export function normalizeIngredient(
  rawName: string,
  currentSection?: string | null,
): NormalizedIngredientResult {
  const trimmed = rawName.trim();
  const existingSection = currentSection?.trim() || null;

  if (!trimmed) {
    return {
      name: '',
      section_name: existingSection,
    };
  }

  let detectedSection: string | null = existingSection;

  const parenMatches = trimmed.matchAll(/\(([^)]*)\)/g);
  for (const match of parenMatches) {
    if (detectedSection) break;
    const inner = match[1]?.trim() ?? '';
    const candidate = extractPurposeSection(inner);
    if (candidate) {
      detectedSection = candidate;
    }
  }

  // Удаляем все скобки (...) и схлопываем лишние пробелы
  const withoutParens = trimmed
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:-]+$/g, '')
    .trim();

  return {
    name: withoutParens || trimmed,
    section_name: detectedSection,
  };
}
