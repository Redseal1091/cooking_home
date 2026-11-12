import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ScaledIngredient, ShoppingListItem } from '@cookbook/shared';
import { supabase } from '@/lib/supabase';
import { getCachedShoppingList, setCachedShoppingList } from '@/lib/offlineCache';

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
            if (!items.value.some((i) => i.id === next.id)) {
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
   * Добавляет один или несколько продуктов с автоматическим суммированием
   * по совпадению названия и единицы измерения (через RPC в БД + локальный фолбэк).
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

    if (!navigator.onLine) {
      const existing = items.value.find(
        (i) =>
          !i.is_checked &&
          i.product_name.trim().toLowerCase() === cleanName.toLowerCase() &&
          i.unit.trim().toLowerCase() === cleanUnit.toLowerCase(),
      );
      if (existing) {
        existing.amount = Math.round((existing.amount + amount) * 100) / 100;
      } else {
        items.value.unshift({
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_name: cleanName,
          amount,
          unit: cleanUnit,
          is_checked: false,
          recipe_title: recipeTitle,
          created_at: new Date().toISOString(),
        });
      }
      await persistCache();
      return;
    }

    const { data, error } = await supabase.rpc('add_or_merge_shopping_item', {
      p_product_name: cleanName,
      p_amount: amount,
      p_unit: cleanUnit,
      p_recipe_title: recipeTitle,
    });

    if (!error && data) {
      const row = data as ShoppingListItem;
      const idx = items.value.findIndex((i) => i.id === row.id);
      if (idx >= 0) {
        items.value[idx] = row;
      } else {
        items.value.unshift(row);
      }
      await persistCache();
    }
  }

  async function addIngredientsFromRecipe(
    scaledIngredients: ScaledIngredient[],
    recipeTitle: string,
  ): Promise<number> {
    const toAdd = scaledIngredients.filter((ing) => ing.name.trim().length > 0);
    for (const ing of toAdd) {
      const qty = ing.scaledAmount ?? 1;
      await addOrMergeItem(ing.name, qty, ing.unit, recipeTitle);
    }
    return toAdd.length;
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
    addOrMergeItem,
    addIngredientsFromRecipe,
    toggleItem,
    deleteItem,
    clearChecked,
  };
});
