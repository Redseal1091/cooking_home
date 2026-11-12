<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';
import { Film, Trash2 } from 'lucide-vue-next';

const props = defineProps(nodeViewProps);

function updateCaption(event: Event) {
  const target = event.target as HTMLInputElement;
  props.updateAttributes({ caption: target.value });
}
</script>

<template>
  <NodeViewWrapper
    class="my-4 overflow-hidden rounded-3xl border border-hairline bg-surface-muted/70 p-3 shadow-organic-sm transition-all"
    :class="{ 'ring-2 ring-accent': selected }"
    data-drag-handle
  >
    <div class="mb-2 flex items-center justify-between gap-2 px-1">
      <div class="flex items-center gap-2 text-xs font-medium text-ink-secondary">
        <Film class="h-4 w-4 text-accent" />
        <span>Короткое видео шага</span>
      </div>
      <button
        type="button"
        class="tactile inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10"
        @click="deleteNode"
      >
        <Trash2 class="h-3.5 w-3.5" />
        <span>Удалить</span>
      </button>
    </div>

    <div class="overflow-hidden rounded-2xl bg-black/90">
      <video
        :src="node.attrs.src"
        controls
        playsinline
        preload="metadata"
        class="max-h-72 w-full object-contain"
      />
    </div>

    <input
      type="text"
      :value="node.attrs.caption || ''"
      placeholder="Подпись к видео (необязательно)..."
      class="mt-2.5 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
      @input="updateCaption"
    />
  </NodeViewWrapper>
</template>
