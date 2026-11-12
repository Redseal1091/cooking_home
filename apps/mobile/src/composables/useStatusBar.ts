import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type StatusBarAppearance = 'light-content' | 'dark-content';

let overlayInitialized = false;

/**
 * Включает прозрачный Edge-to-Edge статус-бар поверх WebView на Android/iOS.
 */
export async function ensureEdgeToEdgeStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: '#00000000' });
    overlayInitialized = true;
  } catch {
    // На старых версиях Android или в вебе вызов может не поддерживаться
  }
}

/**
 * Переключает цвет иконок статус-бара:
 * - `'light-content'` -> `Style.Dark` (белые иконки: тёмная тема, обложка рецепта, онбординг)
 * - `'dark-content'` -> `Style.Light` (тёмные иконки: светлая тема каталога, покупок, настроек)
 */
export async function applyStatusBarAppearance(appearance: StatusBarAppearance): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!overlayInitialized) {
    await ensureEdgeToEdgeStatusBar();
  }
  try {
    await StatusBar.setStyle({
      style: appearance === 'light-content' ? Style.Dark : Style.Light,
    });
  } catch {
    // ignore in non-native environments
  }
}
