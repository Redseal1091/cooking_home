import { Preferences } from '@capacitor/preferences';
import type { RecipeWithIngredients, ShoppingListItem, UserNote } from '@cookbook/shared';

const KEYS = {
  RECIPES: 'cookbook_cached_recipes_v1',
  SHOPPING_LIST: 'cookbook_cached_shopping_v1',
  ONBOARDING_SEEN: 'cookbook_onboarding_seen_v1',
  NOTES_PREFIX: 'cookbook_cached_notes_v1_',
  OFFLINE_QUEUE: 'cookbook_offline_queue_v1',
} as const;

const MEDIA_CACHE_NAME = 'cookbook-media-v1';

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    if (value) return JSON.parse(value) as T;
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

async function setJson<T>(key: string, data: T): Promise<void> {
  const serialized = JSON.stringify(data);
  try {
    await Preferences.set({ key, value: serialized });
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(key, serialized);
  } catch {
    // ignore
  }
}

export async function getCachedRecipes(): Promise<RecipeWithIngredients[]> {
  return getJson<RecipeWithIngredients[]>(KEYS.RECIPES, []);
}

export async function setCachedRecipes(recipes: RecipeWithIngredients[]): Promise<void> {
  await setJson(KEYS.RECIPES, recipes);
}

export async function getCachedShoppingList(): Promise<ShoppingListItem[]> {
  return getJson<ShoppingListItem[]>(KEYS.SHOPPING_LIST, []);
}

export async function setCachedShoppingList(items: ShoppingListItem[]): Promise<void> {
  await setJson(KEYS.SHOPPING_LIST, items);
}

export async function getCachedRecipeNotes(recipeId: string): Promise<UserNote[]> {
  return getJson<UserNote[]>(`${KEYS.NOTES_PREFIX}${recipeId}`, []);
}

export async function setCachedRecipeNotes(recipeId: string, notes: UserNote[]): Promise<void> {
  await setJson(`${KEYS.NOTES_PREFIX}${recipeId}`, notes);
}

export async function hasSeenOnboarding(): Promise<boolean> {
  return getJson<boolean>(KEYS.ONBOARDING_SEEN, false);
}

export async function markOnboardingSeen(): Promise<void> {
  await setJson(KEYS.ONBOARDING_SEEN, true);
}

/**
 * Очищает кэш рецептов, заметок, списка покупок и медиа-кэш фотографий.
 * Настройка темы и статус онбординга сохраняются.
 */
export async function clearOfflineCache(): Promise<void> {
  try {
    const { keys } = await Preferences.keys();
    const toRemove = keys.filter(
      (k) =>
        k === KEYS.RECIPES ||
        k === KEYS.SHOPPING_LIST ||
        k === KEYS.OFFLINE_QUEUE ||
        k.startsWith(KEYS.NOTES_PREFIX),
    );
    await Promise.all(toRemove.map((key) => Preferences.remove({ key })));
  } catch {
    // ignore
  }

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (
        k &&
        (k === KEYS.RECIPES ||
          k === KEYS.SHOPPING_LIST ||
          k === KEYS.OFFLINE_QUEUE ||
          k.startsWith(KEYS.NOTES_PREFIX))
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      await window.caches.delete(MEDIA_CACHE_NAME);
    }
  } catch {
    // ignore
  }
}

export interface OfflineShoppingBatchPayloadItem {
  product_name: string;
  amount: number;
  unit: string;
  recipe_title: string | null;
}

export type OfflineQueueAction =
  | {
      id: string;
      type: 'add_note';
      recipe_id: string;
      note_text: string;
      created_at: string;
    }
  | {
      id: string;
      type: 'toggle_shopping';
      item_id: string;
      is_checked: boolean;
    }
  | {
      id: string;
      type: 'add_shopping_batch';
      items: OfflineShoppingBatchPayloadItem[];
    };

export async function getOfflineQueue(): Promise<OfflineQueueAction[]> {
  return getJson<OfflineQueueAction[]>(KEYS.OFFLINE_QUEUE, []);
}

export async function pushOfflineQueue(action: OfflineQueueAction): Promise<void> {
  const current = await getOfflineQueue();
  current.push(action);
  await setJson(KEYS.OFFLINE_QUEUE, current);
}

export async function setOfflineQueue(queue: OfflineQueueAction[]): Promise<void> {
  await setJson(KEYS.OFFLINE_QUEUE, queue);
}

/**
 * Предварительно кэширует изображения рецептов в Cache Storage,
 * чтобы фото открывались на кухне и в магазине даже без интернета.
 */
export async function cacheMediaUrls(urls: string[]): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;

  const uniqueUrls = Array.from(new Set(urls.filter((u) => Boolean(u && u.startsWith('http')))));
  if (uniqueUrls.length === 0) return 0;

  let cachedCount = 0;
  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (existing) {
            cachedCount++;
            return;
          }
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response.clone());
            cachedCount++;
          }
        } catch {
          // Игнорируем единичные сбои кэширования
        }
      }),
    );
  } catch {
    // ignore
  }
  return cachedCount;
}

/**
 * Пытается достать картинку из Cache Storage в виде Object URL при отсутствии сети.
 */
export async function getCachedMediaObjectUrl(url: string): Promise<string | null> {
  if (!url || typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    const match = await cache.match(url);
    if (!match) return null;
    const blob = await match.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function extractMediaUrlsFromRecipes(recipes: RecipeWithIngredients[]): string[] {
  const urls: string[] = [];
  for (const r of recipes) {
    if (r.cover_url) urls.push(r.cover_url);
    const nodes = r.content_blocks?.content ?? [];
    for (const node of nodes) {
      if (node.type === 'image' && typeof node.attrs?.src === 'string') {
        urls.push(node.attrs.src);
      }
    }
  }
  return urls;
}
