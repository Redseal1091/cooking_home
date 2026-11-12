<script setup lang="ts">
import { ref, watch } from 'vue';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Film,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  Undo2,
} from 'lucide-vue-next';
import type { TipTapDocument } from '@cookbook/shared';
import { VideoBlock } from '@/extensions/VideoBlock';
import { uploadCompressedImage, uploadRecipeVideo } from '@/utils/mediaUpload';

const modelValue = defineModel<TipTapDocument>({ required: true });

const uploadingMedia = ref(false);
const uploadMessage = ref<string | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const videoInputRef = ref<HTMLInputElement | null>(null);

let isInternalUpdate = false;

const editor = useEditor({
  content: modelValue.value,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    ImageExtension.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder:
        'Опишите шаги приготовления… Упоминания времени вроде «15 мин» или «1 час» автоматически станут таймерами в мобильном приложении.',
    }),
    VideoBlock,
  ],
  onUpdate: ({ editor: instance }) => {
    isInternalUpdate = true;
    modelValue.value = instance.getJSON() as TipTapDocument;
  },
});

watch(
  modelValue,
  (nextDoc) => {
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    if (!editor.value) return;
    const currentJson = JSON.stringify(editor.value.getJSON());
    const nextJson = JSON.stringify(nextDoc);
    if (currentJson !== nextJson) {
      editor.value.commands.setContent(nextDoc, false);
    }
  },
  { deep: true },
);

async function handleImagePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !editor.value) return;

  uploadMessage.value = null;
  uploadingMedia.value = true;
  try {
    const res = await uploadCompressedImage(file, 'steps');
    editor.value.chain().focus().setImage({ src: res.publicUrl, alt: 'Шаг приготовления' }).run();
  } catch (err) {
    uploadMessage.value = err instanceof Error ? err.message : 'Ошибка загрузки фото';
  } finally {
    uploadingMedia.value = false;
  }
}

async function handleVideoPicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !editor.value) return;

  uploadMessage.value = null;
  uploadingMedia.value = true;
  try {
    const res = await uploadRecipeVideo(file, 'step-videos');
    editor.value.chain().focus().setVideoBlock({ src: res.publicUrl }).run();
  } catch (err) {
    uploadMessage.value = err instanceof Error ? err.message : 'Ошибка загрузки видео';
  } finally {
    uploadingMedia.value = false;
  }
}
</script>

<template>
  <section class="organic-card rounded-3xl border border-hairline bg-surface p-5 shadow-organic-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="font-display text-base font-bold text-ink">Блочный редактор шагов</h3>
        <p class="text-xs text-ink-secondary">
          Свободно чередуйте текст, пошаговые фото (автосжатие) и короткие видео.
        </p>
      </div>
      <span
        v-if="uploadingMedia"
        class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
      >
        <Loader2 class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Загружаем медиа...
      </span>
    </div>

    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleImagePicked"
    />
    <input
      ref="videoInputRef"
      type="file"
      accept="video/mp4,video/webm,video/quicktime"
      class="hidden"
      @change="handleVideoPicked"
    />

    <!-- Панель инструментов TipTap -->
    <div
      v-if="editor"
      class="mb-3 flex flex-wrap items-center gap-1 rounded-2xl border border-hairline bg-canvas/80 p-1.5"
    >
      <button
        type="button"
        title="Заголовок раздела"
        class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface hover:text-ink"
        :class="{ 'bg-surface text-accent shadow-organic-sm': editor.isActive('heading', { level: 2 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <Heading2 class="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        title="Подзаголовок"
        class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface hover:text-ink"
        :class="{ 'bg-surface text-accent shadow-organic-sm': editor.isActive('heading', { level: 3 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        <Heading3 class="h-4 w-4" aria-hidden="true" />
      </button>

      <div class="mx-1 h-5 w-px bg-hairline" />

      <button
        type="button"
        title="Жирный"
        class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface hover:text-ink"
        :class="{ 'bg-surface text-accent shadow-organic-sm': editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <Bold class="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        title="Курсив"
        class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface hover:text-ink"
        :class="{ 'bg-surface text-accent shadow-organic-sm': editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <Italic class="h-4 w-4" aria-hidden="true" />
      </button>

      <div class="mx-1 h-5 w-px bg-hairline" />

      <button
        type="button"
        title="Нумерованный список шагов"
        class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface hover:text-ink"
        :class="{ 'bg-surface text-accent shadow-organic-sm': editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered class="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        title="Маркированный список"
        class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface hover:text-ink"
        :class="{ 'bg-surface text-accent shadow-organic-sm': editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <List class="h-4 w-4" aria-hidden="true" />
      </button>

      <div class="mx-1 h-5 w-px bg-hairline" />

      <button
        type="button"
        :disabled="uploadingMedia"
        class="tactile inline-flex items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-50"
        @click="imageInputRef?.click()"
      >
        <ImagePlus class="h-4 w-4" aria-hidden="true" />
        <span>Фото</span>
      </button>

      <button
        type="button"
        :disabled="uploadingMedia"
        class="tactile inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-organic-sm hover:bg-surface-muted disabled:opacity-50"
        @click="videoInputRef?.click()"
      >
        <Film class="h-4 w-4 text-accent" aria-hidden="true" />
        <span>Видео</span>
      </button>

      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          title="Отменить"
          :disabled="!editor.can().undo()"
          class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface disabled:opacity-35"
          @click="editor.chain().focus().undo().run()"
        >
          <Undo2 class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Повторить"
          :disabled="!editor.can().redo()"
          class="tactile rounded-xl p-2 text-ink-secondary hover:bg-surface disabled:opacity-35"
          @click="editor.chain().focus().redo().run()"
        >
          <Redo2 class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      v-if="uploadMessage"
      role="alert"
      class="mb-3 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-2.5 text-xs text-danger"
    >
      {{ uploadMessage }}
    </div>

    <div
      class="tiptap-editor rounded-2xl border border-hairline bg-canvas/40 px-4 py-3.5 focus-within:border-accent"
    >
      <EditorContent :editor="editor" />
    </div>
  </section>
</template>
