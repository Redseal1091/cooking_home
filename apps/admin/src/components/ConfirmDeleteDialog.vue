<script setup lang="ts">
import { ref, watch } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';

const props = defineProps<{
  open: boolean;
  recipeTitle: string;
  deleting: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  },
);

function onClose() {
  if (dialogRef.value) dialogRef.value.returnValue = '';
  emit('cancel');
}
</script>

<template>
  <dialog
    ref="dialogRef"
    aria-labelledby="delete-dialog-title"
    class="m-auto w-full max-w-md rounded-4xl border border-hairline bg-surface p-6 text-ink shadow-organic-lg"
    @close="onClose"
  >
    <div class="flex items-start gap-4">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle class="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 id="delete-dialog-title" class="font-display text-lg font-bold text-ink">
          Удалить рецепт?
        </h3>
        <p class="mt-1.5 text-sm text-ink-secondary">
          Рецепт «{{ recipeTitle || 'Без названия' }}» и все его ингредиенты будут удалены безвозвратно.
        </p>
      </div>
    </div>

    <div class="mt-6 flex justify-end gap-2.5">
      <button
        type="button"
        autofocus
        class="tactile rounded-2xl border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted"
        @click="dialogRef?.close()"
      >
        Отмена
      </button>
      <button
        type="button"
        :disabled="deleting"
        class="tactile rounded-2xl bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        @click="emit('confirm')"
      >
        {{ deleting ? 'Удаляем...' : 'Удалить' }}
      </button>
    </div>
  </dialog>
</template>
