<script setup lang="ts">
import { ArrowRight, Sparkles } from 'lucide-vue-next';

const emit = defineEmits<{
  start: [];
}>();
</script>

<template>
  <div class="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#16261E] px-6 py-10 text-white">
    <!-- Атмосферный органический фон -->
    <div
      class="pointer-events-none absolute inset-0"
      style="
        background:
          radial-gradient(circle at 30% 24%, rgba(253, 240, 213, 0.28) 0%, transparent 52%),
          radial-gradient(circle at 80% 30%, rgba(62, 123, 92, 0.45) 0%, transparent 55%),
          radial-gradient(circle at 50% 85%, rgba(17, 18, 17, 0.92) 0%, rgba(17, 18, 17, 0.4) 60%),
          linear-gradient(160deg, #1E3328 0%, #141915 58%, #0E100E 100%);
      "
    />

    <!-- Единая вертикально отцентрированная композиция: маскот + текст -->
    <div class="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
      <!-- Маскот Пухни -->
      <div
        class="relative flex h-56 w-56 items-center justify-center rounded-full border border-white/15 bg-white/5 shadow-glass backdrop-blur-md"
      >
        <div
          class="flex h-44 w-44 items-center justify-center overflow-hidden rounded-full bg-[#FDF0D5] shadow-organic-lg"
        >
          <img
            src="/mascot.png"
            alt="Маскот Пухни — пельмешек-повар"
            class="h-full w-full object-cover"
          />
        </div>
        <span
          class="glass-pill absolute -bottom-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium"
        >
          <Sparkles class="h-3.5 w-3.5 text-[#E8C58E]" aria-hidden="true" />
          Семейная книга
        </span>
      </div>

      <!-- Приветствие, прижатое к иллюстрации -->
      <div class="w-full space-y-3 pt-1">
        <span class="inline-block rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-md">
          Домашняя кулинария
        </span>

        <h1 class="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-white">
          Пухня
        </h1>

        <p class="mx-auto max-w-sm text-sm leading-relaxed text-white/75">
          Уютные семейные рецепты, умный пересчёт ингредиентов от остатков в холодильнике, таймеры и общий список покупок.
        </p>

        <button
          type="button"
          class="tactile mt-3 flex w-full items-center justify-center gap-2.5 rounded-3xl bg-accent px-6 py-4 font-display text-base font-bold text-white shadow-organic-lg hover:bg-accent-hover"
          @click="emit('start')"
        >
          <span>Открыть Пухню</span>
          <ArrowRight class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
