import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ScaledIngredient, ShoppingListItem } from '@cookbook/shared';
import { supabase } from '@/lib/supabase';
import {
  getCachedShoppingList,
  getOfflineQueue,
  pushOfflineQueue,
  setCachedShoppingList,
  setOfflineQueue,
  type OfflineShoppingBatchPayloadItem,
} from '@/lib/offlineCache';

export interface ShoppingItemPatch {
  product_name?: string;
  amount?: number;
  unit?: string;
}

export const useShoppingListStore = defineStore('mobile-shopping', () => {
  const items = ref<ShoppingListItem[]>([]);
  const loading = ref(false);
  const realtimeConnected = ref(false);
  let channel: RealtimeChannel | null = null;

  const uncheckedCount = computed(
    () => items.value.filter((i) => !i.is_checked).length,
  );

  const sortedItems = computed(() =>
    [...items.value].sort((a, b) => {
      if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    }),
  );

  async function persistCache() {
    await setCachedShoppingList(items.value);
  }

  async function loadInitial() {
    const cached = await getCachedShoppingList();
    if (cached.length > 0) {
      items.value = cached;
    }

    if (navigator.onLine) {
      await flushOfflineBatchQueue();
      await fetchItems();
      subscribeRealtime();
    }
  }

  async function fetchItems() {
    if (!navigator.onLine) return;
    loading.value = items.value.length === 0;
    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      items.value = (data ?? []) as ShoppingListItem[];
      await persistCache();
    } catch {
      // Используем локальный кэш
    } finally {
      loading.value = false;
    }
  }

  function subscribeRealtime() {
    if (channel) return;

    channel = supabase
      .channel('family_shopping_list_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const next = payload.new as ShoppingListItem;
            const localIdx = items.value.findIndex(
              (i) =>
                i.id.startsWith('local-') &&
                !i.is_checked &&
                i.product_name.trim().toLowerCase() === next.product_name.trim().toLowerCase() &&
                i.unit.trim().toLowerCase() === next.unit.trim().toLowerCase(),
            );
            if (localIdx >= 0) {
              items.value[localIdx] = next;
            } else if (!items.value.some((i) => i.id === next.id)) {
              items.value.unshift(next);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ShoppingListItem;
            const idx = items.value.findIndex((i) => i.id === updated.id);
            if (idx >= 0) {
              items.value[idx] = updated;
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) {
              items.value = items.value.filter((i) => i.id !== oldId);
            }
          }
          void persistCache();
        },
      )
      .subscribe((status) => {
        realtimeConnected.value = status === 'SUBSCRIBED';
      });
  }

  function unsubscribeRealtime() {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
      realtimeConnected.value = false;
    }
  }

  /**
   * Мгновенно (Optimistic UI) объединяет или добавляет список продуктов в локальном сторе
   * и возвращает ключи/ссылки для последующей синхронизации с ответом БД.
   */
  function applyOptimisticBatch(batch: OfflineShoppingBatchPayloadItem[]) {
    const nowIso = new Date().toISOString();

    for (const entry of batch) {
      const cleanName = entry.product_name.trim();
      const cleanUnit = entry.unit.trim() || 'шт';
      const qty = Number(entry.amount) > 0 ? Number(entry.amount) : 1;
      const recipeTitle = entry.recipe_title?.trim() || null;
      if (!cleanName) continue;

      const existing = items.value.find(
        (i) =>
          !i.is_checked &&
          i.product_name.trim().toLowerCase() === cleanName.toLowerCase() &&
          i.unit.trim().toLowerCase() === cleanUnit.toLowerCase(),
      );

      if (existing) {
        existing.amount = Math.round((existing.amount + qty) * 100) / 100;
        if (recipeTitle) {
          if (!existing.recipe_title) {
            existing.recipe_title = recipeTitle;
          } else if (!existing.recipe_title.includes(recipeTitle)) {
            existing.recipe_title = `${existing.recipe_title}, ${recipeTitle}`;
          }
        }
      } else {
        items.value.unshift({
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product_name: cleanName,
          amount: qty,
          unit: cleanUnit,
          is_checked: false,
          recipe_title: recipeTitle,
          created_at: nowIso,
        });
      }
    }
  }

  function reconcileServerRows(rows: ShoppingListItem[]) {
    for (const row of rows) {
      const byIdIdx = items.value.findIndex((i) => i.id === row.id);
      if (byIdIdx >= 0) {
        items.value[byIdIdx] = row;
        continue;
      }

      const localIdx = items.value.findIndex(
        (i) =>
          i.id.startsWith('local-') &&
          !i.is_checked &&
          i.product_name.trim().toLowerCase() === row.product_name.trim().toLowerCase() &&
          i.unit.trim().toLowerCase() === row.unit.trim().toLowerCase(),
      );

      if (localIdx >= 0) {
        items.value[localIdx] = row;
      } else {
        items.value.unshift(row);
      }
    }
  }

  async function syncBatchInBackground(batch: OfflineShoppingBatchPayloadItem[]) {
    if (batch.length === 0) return;

    if (!navigator.onLine) {
      await pushOfflineQueue({
        id: `batch-${Date.now()}`,
        type: 'add_shopping_batch',
        items: batch,
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('add_or_merge_shopping_items_batch', {
        items: batch,
      });

      if (error) throw error;
      if (Array.isArray(data)) {
        reconcileServerRows(data as ShoppingListItem[]);
        await persistCache();
      }
    } catch {
      await pushOfflineQueue({
        id: `batch-${Date.now()}`,
        type: 'add_shopping_batch',
        items: batch,
      });
    }
  }

  async function flushOfflineBatchQueue() {
    if (!navigator.onLine) return;
    const queue = await getOfflineQueue();
    const batchActions = queue.filter((q) => q.type === 'add_shopping_batch');
    if (batchActions.length === 0) return;

    const remaining: typeof queue = queue.filter((q) => q.type !== 'add_shopping_batch');
    for (const action of batchActions) {
      if (action.type !== 'add_shopping_batch') continue;
      try {
        const { error } = await supabase.rpc('add_or_merge_shopping_items_batch', {
          items: action.items,
        });
        if (error) throw error;
      } catch {
        remaining.push(action);
      }
    }
    await setOfflineQueue(remaining);
  }

  /**
   * Optimistic UI: мгновенное добавление одного продукта.
   */
  async function addOrMergeItem(
    productName: string,
    amount: number,
    unit: string,
    recipeTitle: string | null = null,
  ) {
    const cleanName = productName.trim();
    const cleanUnit = unit.trim() || 'шт';
    if (!cleanName) return;

    const payload: OfflineShoppingBatchPayloadItem[] = [
      {
        product_name: cleanName,
        amount: amount > 0 ? amount : 1,
        unit: cleanUnit,
        recipe_title: recipeTitle,
      },
    ];

    // 1. Мгновенно (0 мс) обновляем локальный стор и кэш
    applyOptimisticBatch(payload);
    void persistCache();

    // 2. Отправляем в Supabase в фоне
    void syncBatchInBackground(payload);
  }

  /**
   * Optimistic UI + Batch RPC: все ингредиенты рецепта добавляются за 0 мс локально
   * и улетают в Supabase одним пакетным RPC-запросом в фоне.
   */
  function addIngredientsFromRecipe(
    scaledIngredients: ScaledIngredient[],
    recipeTitle: string,
  ): number {
    const batch: OfflineShoppingBatchPayloadItem[] = scaledIngredients
      .filter((ing) => ing.name.trim().length > 0)
      .map((ing) => ({
        product_name: ing.name.trim(),
        amount: ing.scaledAmount ?? 1,
        unit: ing.unit.trim() || 'шт',
        recipe_title: recipeTitle,
      }));

    if (batch.length === 0) return 0;

    // 1. Мгновенное обновление Pinia и кэша
    applyOptimisticBatch(batch);
    void persistCache();

    // 2. Один пакетный сетевой запрос в фоне
    void syncBatchInBackground(batch);

    return batch.length;
  }

  /**
   * Optimistic UI: быстрое редактирование названия, количества или единицы измерения.
   */
  async function updateItem(id: string, patch: ShoppingItemPatch) {
    const target = items.value.find((i) => i.id === id);
    if (!target) return;

    const nextPatch: ShoppingItemPatch = {};
    if (patch.product_name !== undefined) {
      const cleanName = patch.product_name.trim();
      if (cleanName) {
        target.product_name = cleanName;
        nextPatch.product_name = cleanName;
      }
    }
    if (patch.amount !== undefined && !Number.isNaN(patch.amount) && patch.amount > 0) {
      const rounded = Math.round(patch.amount * 100) / 100;
      target.amount = rounded;
      nextPatch.amount = rounded;
    }
    if (patch.unit !== undefined) {
      const cleanUnit = patch.unit.trim() || 'шт';
      target.unit = cleanUnit;
      nextPatch.unit = cleanUnit;
    }

    await persistCache();

    if (navigator.onLine && !id.startsWith('local-') && Object.keys(nextPatch).length > 0) {
      await supabase.from('shopping_list').update(nextPatch).eq('id', id);
    }
  }

  async function toggleItem(id: string) {
    const target = items.value.find((i) => i.id === id);
    if (!target) return;

    target.is_checked = !target.is_checked;
    await persistCache();

    if (navigator.onLine && !id.startsWith('local-')) {
      await supabase
        .from('shopping_list')
        .update({ is_checked: target.is_checked })
        .eq('id', id);
    }
  }

  async function deleteItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
    await persistCache();

    if (navigator.onLine && !id.startsWith('local-')) {
      await supabase.from('shopping_list').delete().eq('id', id);
    }
  }

  async function clearChecked() {
    const checkedIds = items.value.filter((i) => i.is_checked).map((i) => i.id);
    if (checkedIds.length === 0) return;

    items.value = items.value.filter((i) => !i.is_checked);
    await persistCache();

    const remoteIds = checkedIds.filter((id) => !id.startsWith('local-'));
    if (navigator.onLine && remoteIds.length > 0) {
      await supabase.from('shopping_list').delete().in('id', remoteIds);
    }
  }

  return {
    items,
    loading,
    realtimeConnected,
    uncheckedCount,
    sortedItems,
    loadInitial,
    fetchItems,
    subscribeRealtime,
    unsubscribeRealtime,
    flushOfflineBatchQueue,
    addOrMergeItem,
    addIngredientsFromRecipe,
    updateItem,
    toggleItem,
    deleteItem,
    clearChecked,
  };
});
