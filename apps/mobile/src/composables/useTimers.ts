import { computed, ref } from 'vue';
import { LocalNotifications } from '@capacitor/local-notifications';
import { formatTimerSeconds } from '@cookbook/shared';

export interface ActiveTimer {
  id: number;
  label: string;
  recipeTitle: string;
  totalSeconds: number;
  remainingSeconds: number;
  endsAtMs: number;
  paused: boolean;
  finished: boolean;
}

const activeTimer = ref<ActiveTimer | null>(null);
let intervalId: ReturnType<typeof setInterval> | null = null;
let notificationCounter = 1000;

async function ensureNotificationPermission() {
  try {
    const check = await LocalNotifications.checkPermissions();
    if (check.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    // Web / unsupported fallback
  }
}

async function scheduleLocalNotification(timer: ActiveTimer) {
  try {
    await ensureNotificationPermission();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: timer.id,
          title: `Таймер готов: ${timer.label}`,
          body: timer.recipeTitle
            ? `Блюдо «${timer.recipeTitle}» — пора проверить следующий шаг!`
            : 'Время вышло!',
          schedule: { at: new Date(timer.endsAtMs), allowWhileIdle: true },
          sound: undefined,
        },
      ],
    });
  } catch {
    // Ignore on desktop browser
  }
}

async function cancelLocalNotification(id: number) {
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Ignore on desktop browser
  }
}

function playKitchenChime() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([250, 120, 250, 120, 350]);
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = [880, 1108.73, 1318.51]; // A5 - C#6 - E6 приятный перезвон
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.16;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.68);
    });
  } catch {
    // ignore audio restrictions
  }
}

function startTicking() {
  stopTicking();
  intervalId = setInterval(() => {
    const t = activeTimer.value;
    if (!t || t.paused || t.finished) return;

    const left = Math.max(0, Math.ceil((t.endsAtMs - Date.now()) / 1000));
    t.remainingSeconds = left;

    if (left <= 0) {
      t.finished = true;
      stopTicking();
      playKitchenChime();
    }
  }, 500);
}

function stopTicking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useTimers() {
  async function startTimer(seconds: number, label: string, recipeTitle = '') {
    if (activeTimer.value) {
      await cancelLocalNotification(activeTimer.value.id);
    }

    const id = ++notificationCounter;
    const now = Date.now();
    const timer: ActiveTimer = {
      id,
      label,
      recipeTitle,
      totalSeconds: seconds,
      remainingSeconds: seconds,
      endsAtMs: now + seconds * 1000,
      paused: false,
      finished: false,
    };

    activeTimer.value = timer;
    startTicking();
    await scheduleLocalNotification(timer);
  }

  async function togglePause() {
    const t = activeTimer.value;
    if (!t || t.finished) return;

    if (t.paused) {
      t.paused = false;
      t.endsAtMs = Date.now() + t.remainingSeconds * 1000;
      startTicking();
      await scheduleLocalNotification(t);
    } else {
      t.paused = true;
      stopTicking();
      await cancelLocalNotification(t.id);
    }
  }

  async function dismissTimer() {
    if (activeTimer.value) {
      await cancelLocalNotification(activeTimer.value.id);
    }
    stopTicking();
    activeTimer.value = null;
  }

  const formattedRemaining = computed(() =>
    activeTimer.value ? formatTimerSeconds(activeTimer.value.remainingSeconds) : '00:00',
  );

  const progressPercent = computed(() => {
    const t = activeTimer.value;
    if (!t || t.totalSeconds <= 0) return 0;
    return Math.min(100, Math.max(0, ((t.totalSeconds - t.remainingSeconds) / t.totalSeconds) * 100));
  });

  return {
    activeTimer,
    formattedRemaining,
    progressPercent,
    startTimer,
    togglePause,
    dismissTimer,
  };
}
