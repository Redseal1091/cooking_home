<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { App as CapApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import type { RecipeWithIngredients } from '@cookbook/shared';
import { useTheme } from '@/composables/useTheme';
import {
  applyStatusBarAppearance,
  ensureEdgeToEdgeStatusBar,
} from '@/composables/useStatusBar';
import { useAppStore } from '@/stores/app';
import { useMobileRecipesStore } from '@/stores/recipes';
import { useShoppingListStore } from '@/stores/shoppingList';
import OnboardingCover from '@/components/OnboardingCover.vue';
import CatalogView from '@/components/CatalogView.vue';
import RecipeDetailView from '@/components/RecipeDetailView.vue';
import ShoppingListView from '@/components/ShoppingListView.vue';
import SettingsView from '@/components/SettingsView.vue';
import FloatingTimerBar from '@/components/FloatingTimerBar.vue';
import BottomTabBar, { type MobileTab } from '@/components/BottomTabBar.vue';

const { isDark } = useTheme();

const appStore = useAppStore();
const recipesStore = useMobileRecipesStore();
const shoppingStore = useShoppingListStore();

const activeTab = ref<MobileTab>('catalog');
const selectedRecipe = ref<RecipeWithIngredients | null>(null);
let backButtonHandle: PluginListenerHandle | null = null;

watch(
  [
    () => appStore.initializing,
    () => appStore.onboardingSeen,
    () => Boolean(selectedRecipe.value),
    isDark,
  ],
  ([initializing, onboardingSeen, hasSelectedRecipe, dark]) => {
    if (initializing) {
      void applyStatusBarAppearance(dark ? 'light-content' : 'dark-content');
      return;
    }
    const useLightIcons = !onboardingSeen || hasSelectedRecipe || dark;
    void applyStatusBarAppearance(useLightIcons ? 'light-content' : 'dark-content');
  },
  { immediate: true },
);

function handleNetworkChange() {
  recipesStore.updateOnlineStatus();
  if (navigator.onLine) {
    void shoppingStore.flushOfflineBatchQueue().then(() => shoppingStore.fetchItems());
    shoppingStore.subscribeRealtime();
  }
}

function openRecipe(recipe: RecipeWithIngredients) {
  selectedRecipe.value = recipe;
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

function closeRecipe() {
  selectedRecipe.value = null;
}

onMounted(async () => {
  void ensureEdgeToEdgeStatusBar();
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);

  try {
    backButtonHandle = await CapApp.addListener('backButton', () => {
      // 1. Закрываем верхнее открытое модальное окно или панель фильтра
      if (appStore.closeTopModal()) {
        return;
      }

      // 2. Если открыт экран рецепта — возвращаемся в каталог
      if (selectedRecipe.value) {
        closeRecipe();
        return;
      }

      // 3. Если открыты Покупки или Настройки — переходим в Каталог
      if (activeTab.value !== 'catalog') {
        activeTab.value = 'catalog';
        return;
      }

      // 4. На корневом экране каталога сворачиваем приложение
      void CapApp.minimizeApp();
    });
  } catch {
    // В обычном веб-браузере нативный listener не требуется
  }

  await appStore.init();
  await Promise.all([
    recipesStore.loadInitial(),
    shoppingStore.loadInitial(),
  ]);
});

onUnmounted(() => {
  window.removeEventListener('online', handleNetworkChange);
  window.removeEventListener('offline', handleNetworkChange);
  shoppingStore.unsubscribeRealtime();
  void backButtonHandle?.remove();
});
</script>

<template>
  <div v-if="appStore.initializing" class="flex min-h-dvh items-center justify-center text-sm text-ink-secondary">
    Открываем книгу...
  </div>

  <Transition name="fade" mode="out-in">
    <OnboardingCover
      v-if="!appStore.onboardingSeen"
      @start="appStore.completeOnboarding()"
    />

    <div v-else class="mx-auto min-h-dvh w-full max-w-lg overflow-x-clip">
      <Transition name="slide" mode="out-in">
        <RecipeDetailView
          v-if="selectedRecipe"
          :key="selectedRecipe.id"
          :recipe="selectedRecipe"
          @back="closeRecipe"
        />

        <CatalogView
          v-else-if="activeTab === 'catalog'"
          @open-recipe="openRecipe"
        />

        <ShoppingListView v-else-if="activeTab === 'shopping'" />

        <SettingsView v-else />
      </Transition>

      <FloatingTimerBar />

      <BottomTabBar
        v-if="!selectedRecipe"
        :active-tab="activeTab"
        :shopping-badge="shoppingStore.uncheckedCount"
        @change="activeTab = $event"
      />
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
.slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
