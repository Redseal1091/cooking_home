import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'recipe-media';
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

export interface CompressedImageResult {
  blob: Blob;
  mimeType: string;
  extension: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

export interface UploadedMediaResult {
  publicUrl: string;
  originalBytes: number;
  uploadedBytes: number;
}

/**
 * Сжимает изображение на клиенте (Canvas -> WebP с fallback на JPEG),
 * ограничивая максимальную сторону до `maxDimension` px.
 */
export async function compressImageFile(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<CompressedImageResult> {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.84;

  const bitmap = await loadImageSource(file);
  const { width: srcW, height: srcH } = bitmap;

  let targetW = srcW;
  let targetH = srcH;
  if (srcW > maxDimension || srcH > maxDimension) {
    if (srcW >= srcH) {
      targetW = maxDimension;
      targetH = Math.round((srcH / srcW) * maxDimension);
    } else {
      targetH = maxDimension;
      targetW = Math.round((srcW / srcH) * maxDimension);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать Canvas 2D для сжатия изображения');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap.source, 0, 0, targetW, targetH);
  bitmap.cleanup();

  // Пробуем WebP (лучшее сжатие), иначе JPEG
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  let mimeType = 'image/webp';
  let extension = 'webp';

  if (!blob || blob.size === 0 || blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    mimeType = 'image/jpeg';
    extension = 'jpg';
  }

  if (!blob) {
    throw new Error('Не удалось сжать изображение');
  }

  // Если сжатый файл неожиданно больше оригинала, а оригинал и так лёгкий, оставляем оригинал
  if (blob.size >= file.size && file.size < 250 * 1024 && file.type.startsWith('image/')) {
    const fallbackExt = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return {
      blob: file,
      mimeType: file.type,
      extension: fallbackExt,
      originalBytes: file.size,
      compressedBytes: file.size,
      width: targetW,
      height: targetH,
    };
  }

  return {
    blob,
    mimeType,
    extension,
    originalBytes: file.size,
    compressedBytes: blob.size,
    width: targetW,
    height: targetH,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
}

async function loadImageSource(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if ('createImageBitmap' in window) {
    const bmp = await createImageBitmap(file);
    return {
      source: bmp,
      width: bmp.width,
      height: bmp.height,
      cleanup: () => bmp.close(),
    };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Сжимает фото и загружает в бакет `recipe-media`.
 */
export async function uploadCompressedImage(
  file: File,
  folder: 'covers' | 'steps',
): Promise<UploadedMediaResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Пожалуйста, выберите файл изображения (JPG, PNG, WebP)');
  }

  const maxDimension = folder === 'covers' ? 1600 : 1280;
  const compressed = await compressImageFile(file, { maxDimension, quality: 0.84 });
  const filePath = `${folder}/${generateId()}.${compressed.extension}`;

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, compressed.blob, {
    contentType: compressed.mimeType,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    throw new Error(`Ошибка загрузки изображения: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  return {
    publicUrl: data.publicUrl,
    originalBytes: compressed.originalBytes,
    uploadedBytes: compressed.compressedBytes,
  };
}

/**
 * Загружает короткое видео (до 50 МБ) в бакет `recipe-media`.
 */
export async function uploadRecipeVideo(
  file: File,
  folder: 'previews' | 'step-videos',
): Promise<UploadedMediaResult> {
  const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowed.includes(file.type)) {
    throw new Error('Поддерживаются только видео в формате MP4, WebM или MOV');
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Видео слишком большое (максимум 50 МБ)');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const filePath = `${folder}/${generateId()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    throw new Error(`Ошибка загрузки видео: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  return {
    publicUrl: data.publicUrl,
    originalBytes: file.size,
    uploadedBytes: file.size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
