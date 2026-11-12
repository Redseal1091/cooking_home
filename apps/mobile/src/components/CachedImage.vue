<script setup lang="ts">
import { computed } from 'vue';
import { UtensilsCrossed } from 'lucide-vue-next';
import { useOfflineImage } from '@/composables/useOfflineImage';

const props = defineProps<{
  src: string | null | undefined;
  alt: string;
  imgClass?: string;
}>();

const { resolvedUrl, handleImageError } = useOfflineImage(computed(() => props.src));
</script>

<template>
  <img
    v-if="resolvedUrl"
    :src="resolvedUrl"
    :alt="alt"
    :class="imgClass"
    loading="lazy"
    @error="handleImageError"
  />
  <div
    v-else
    class="flex h-full w-full items-center justify-center bg-surface-muted text-ink-tertiary"
  >
    <UtensilsCrossed class="h-8 w-8 opacity-60" aria-hidden="true" />
  </div>
</template>
