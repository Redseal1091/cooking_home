<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff, Lock, Mail } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);

async function handleSubmit() {
  if (!email.value.trim() || !password.value) return;
  await auth.signIn(email.value, password.value);
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
    <div class="absolute right-6 top-6">
      <ThemeToggle />
    </div>

    <div
      class="organic-card squircle w-full max-w-md rounded-4xl border border-hairline bg-surface p-8 shadow-organic-lg"
    >
      <div class="mb-7 flex flex-col items-center text-center">
        <div
          class="mb-4 h-20 w-20 overflow-hidden rounded-3xl border border-hairline bg-[#FDF0D5] shadow-organic-sm"
        >
          <img
            src="/mascot.png"
            alt="Пухня"
            class="h-full w-full object-cover"
          />
        </div>
        <h1 class="font-display text-2xl font-extrabold text-ink">Пухня</h1>
        <p class="mt-1.5 text-sm text-ink-secondary">
          Вход в админ-панель кулинарной книги
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="handleSubmit">
        <div>
          <label for="admin-email" class="mb-1.5 block text-sm font-medium text-ink">
            Email
          </label>
          <div class="relative">
            <Mail
              class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
              aria-hidden="true"
            />
            <input
              id="admin-email"
              v-model="email"
              type="email"
              name="email"
              autocomplete="username"
              spellcheck="false"
              enterkeyhint="next"
              required
              placeholder="family@example.com"
              class="organic-input w-full rounded-2xl border border-hairline bg-canvas/70 py-3 pl-10 pr-4 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p class="field-error mt-1.5 hidden items-center gap-1.5 text-xs text-danger">
              <span>Введите корректный email.</span>
            </p>
          </div>
        </div>

        <div>
          <label for="admin-password" class="mb-1.5 block text-sm font-medium text-ink">
            Пароль
          </label>
          <div class="relative">
            <Lock
              class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
              aria-hidden="true"
            />
            <input
              id="admin-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              enterkeyhint="done"
              required
              placeholder="••••••••"
              class="organic-input w-full rounded-2xl border border-hairline bg-canvas/70 py-3 pl-10 pr-11 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              class="tactile absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-ink-secondary hover:bg-surface-muted hover:text-ink"
              :aria-pressed="showPassword"
              :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="h-4 w-4" aria-hidden="true" />
              <Eye v-else class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          v-if="auth.authError"
          role="alert"
          class="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {{ auth.authError }}
        </div>

        <button
          type="submit"
          :disabled="auth.submitting"
          class="tactile flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-contrast shadow-organic-md hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span v-if="auth.submitting">Входим...</span>
          <span v-else>Войти в админку</span>
        </button>
      </form>
    </div>
  </div>
</template>
