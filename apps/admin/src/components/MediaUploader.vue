<script setup lang="ts">
import { ref } from 'vue';
import { Film, ImagePlus, Loader2, Sparkles, Trash2, Upload } from 'lucide-vue-next';
import { formatBytes, uploadCompressedImage, uploadRecipeVideo } from '@/utils/mediaUpload';

const coverUrl = defineModel<string | null>('coverUrl', { required: true });
const videoPreviewUrl = defineModel<string | null>('videoPreviewUrl', { required: true });

const uploadingCover = ref(false);
const uploadingVideo = ref(false);
const compressionStats = ref<string | null>(null);
const uploadError = ref<string | null>(null);

const coverInputRef = ref<HTMLInputElement | null>(null);
const videoInputRef = ref<HTMLInputElement | null>(null);

async function processCoverFile(file: File) {
  uploadError.value = null;
  compressionStats.value = null;
  uploadingCover.value = true;
  try {
    const res = await uploadCompressedImage(file, 'covers');
    coverUrl.value = res.publicUrl;
    compressionStats.value = `Сжато: ${formatBytes(res.originalBytes)} → ${formatBytes(res.uploadedBytes)}`;
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Ошибка загрузки обложки';
  } finally {
    uploadingCover.value = false;
  }
}

async function processVideoFile(file: File) {
  uploadError.value = null;
  uploadingVideo.value = true;
  try {
    const res = await uploadRecipeVideo(file, 'previews');
    videoPreviewUrl.value = res.publicUrl;
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Ошибка загрузки видео';
  } finally {
    uploadingVideo.value = false;
  }
}

function onCoverChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void processCoverFile(file);
  input.value = '';
}

function onVideoChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void processVideoFile(file);
  input.value = '';
}

function onCoverDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) {
    void processCoverFile(file);
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 md:grid-cols-2">
      <!-- Обложка рецепта -->
      <div
        class="organic-card relative overflow-hidden rounded-3xl border border-hairline bg-canvas/50 p-4"
        @dragover.prevent
        @drop.prevent="onCoverDrop"
      >
        <div class="mb-2.5 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Обложка рецепта
          </span>
          <span
            v-if="compressionStats"
            class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent"
          >
            <Sparkles class="h-3 w-3" aria-hidden="true" />
            {{ compressionStats }}
          </span>
        </div>

        <input
          ref="coverInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onCoverChange"
        />

        <div
          v-if="coverUrl"
          class="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-muted"
        >
          <img
            :src="coverUrl"
            alt="Обложка рецепта"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div
            class="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3"
          >
            <button
              type="button"
              class="tactile glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              @click="coverInputRef?.click()"
            >
              <Upload class="h-3.5 w-3.5" aria-hidden="true" />
              Заменить
            </button>
            <button
              type="button"
              class="tactile inline-flex items-center gap-1 rounded-full bg-danger/90 px-3 py-1.5 text-xs font-medium text-white"
              @click="coverUrl = null"
            >
              <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
              Удалить
            </button>
          </div>
        </div>

        <button
          v-else
          type="button"
          :disabled="uploadingCover"
          class="tactile flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-surface/60 p-4 text-center hover:border-accent hover:bg-accent-soft/30"
          @click="coverInputRef?.click()"
        >
          <Loader2
            v-if="uploadingCover"
            class="h-7 w-7 animate-spin text-accent"
            aria-hidden="true"
          />
          <ImagePlus v-else class="h-7 w-7 text-accent" aria-hidden="true" />
          <span class="text-sm font-medium text-ink">
            {{ uploadingCover ? 'Сжимаем и загружаем...' : 'Загрузить фото обложки' }}
          </span>
          <span class="text-xs text-ink-tertiary">
            Автосжатие в WebP перед отправкой · перетащите или выберите
          </span>
        </button>
      </div>

      <!-- Видео-превью (опционально) -->
      <div class="organic-card relative overflow-hidden rounded-3xl border border-hairline bg-canvas/50 p-4">
        <div class="mb-2.5 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Превью-видео (опционально)
          </span>
          <span class="text-[11px] text-ink-tertiary">MP4 / WebM до 50 МБ</span>
        </div>

        <input
          ref="videoInputRef"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          class="hidden"
          @change="onVideoChange"
        />

        <div
          v-if="videoPreviewUrl"
          class="relative aspect-[16/10] overflow-hidden rounded-2xl bg-black"
        >
          <video
            :src="videoPreviewUrl"
            controls
            playsinline
            preload="metadata"
            class="h-full w-full object-contain"
          />
          <button
            type="button"
            class="tactile absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-danger/90 px-2.5 py-1 text-xs font-medium text-white shadow-sm"
            @click="videoPreviewUrl = null"
          >
            <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
            Убрать
          </button>
        </div>

        <button
          v-else
          type="button"
          :disabled="uploadingVideo"
          class="tactile flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-surface/60 p-4 text-center hover:border-accent hover:bg-accent-soft/30"
          @click="videoInputRef?.click()"
        >
          <Loader2
            v-if="uploadingVideo"
            class="h-7 w-7 animate-spin text-accent"
            aria-hidden="true"
          />
          <Film v-else class="h-7 w-7 text-ink-secondary" aria-hidden="true" />
          <span class="text-sm font-medium text-ink">
            {{ uploadingVideo ? 'Загружаем видео...' : 'Добавить короткое видео' }}
          </span>
          <span class="text-xs text-ink-tertiary">
            Отображается в шапке экрана рецепта с кнопкой Play
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="uploadError"
      role="alert"
      class="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-2.5 text-xs text-danger"
    >
      {{ uploadError }}
    </div>
  </div>
</template>
