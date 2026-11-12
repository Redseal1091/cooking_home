import { computed, ref } from 'vue';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { ApkInstaller } from '@/lib/apkInstaller';
import {
  checkGithubLatestRelease,
  loadSavedGithubRepo,
  saveGithubRepo,
  type ReleaseUpdateInfo,
} from '@/lib/appInfo';

const DISMISSED_VERSION_KEY = 'pukhnya_dismissed_update_version_v1';

function readDismissedVersion(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeDismissedVersion(version: string) {
  try {
    sessionStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {
    // ignore
  }
}

const availableUpdate = ref<ReleaseUpdateInfo | null>(null);
const dismissedVersion = ref<string | null>(readDismissedVersion());
const checkingUpdates = ref(false);
const updateCheckError = ref<string | null>(null);
const downloadingUpdate = ref(false);
const downloadProgress = ref<number | null>(null);
const downloadIndeterminate = ref(false);
const downloadError = ref<string | null>(null);
let quietCheckStarted = false;

export function useAppUpdater() {
  const showUpdateBanner = computed(() => {
    const info = availableUpdate.value;
    if (!info || !info.hasUpdate) return false;
    if (downloadingUpdate.value) return true;
    return dismissedVersion.value !== info.latestVersion;
  });

  async function checkForUpdateQuietly(): Promise<void> {
    if (quietCheckStarted) return;
    quietCheckStarted = true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      const repo = await loadSavedGithubRepo();
      const info = await checkGithubLatestRelease(repo);
      if (info.hasUpdate) {
        availableUpdate.value = info;
      }
    } catch {
      // Тихая проверка не должна беспокоить пользователя ошибками
    }
  }

  async function checkForUpdateManual(repoInput: string): Promise<ReleaseUpdateInfo | null> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      updateCheckError.value = 'Нет подключения к интернету для проверки обновлений.';
      return null;
    }

    checkingUpdates.value = true;
    updateCheckError.value = null;
    downloadError.value = null;

    try {
      const cleanRepo = await saveGithubRepo(repoInput);
      const info = await checkGithubLatestRelease(cleanRepo);
      if (info.hasUpdate) {
        availableUpdate.value = info;
      }
      return info;
    } catch (err) {
      updateCheckError.value =
        err instanceof Error ? err.message : 'Ошибка проверки обновлений';
      return null;
    } finally {
      checkingUpdates.value = false;
    }
  }

  function dismissUpdateBanner() {
    const ver = availableUpdate.value?.latestVersion;
    if (!ver) return;
    dismissedVersion.value = ver;
    writeDismissedVersion(ver);
  }

  async function downloadAndInstallUpdate(target?: ReleaseUpdateInfo | null): Promise<boolean> {
    const info = target ?? availableUpdate.value;
    if (!info?.apkDownloadUrl) return false;
    if (downloadingUpdate.value) return false;

    if (!Capacitor.isNativePlatform()) {
      window.open(info.apkDownloadUrl, '_blank', 'noopener,noreferrer');
      return true;
    }

    downloadingUpdate.value = true;
    downloadProgress.value = 0;
    downloadIndeterminate.value = false;
    downloadError.value = null;

    let progressHandle: PluginListenerHandle | null = null;
    try {
      progressHandle = await ApkInstaller.addListener('downloadProgress', (evt) => {
        downloadIndeterminate.value = Boolean(evt.indeterminate);
        if (typeof evt.progress === 'number' && !Number.isNaN(evt.progress)) {
          downloadProgress.value = Math.max(0, Math.min(100, Math.round(evt.progress)));
        }
      });

      await ApkInstaller.downloadAndInstall({
        url: info.apkDownloadUrl,
        fileName: info.apkFileName || `pukhnya-${info.latestVersion}.apk`,
      });

      downloadProgress.value = 100;
      downloadIndeterminate.value = false;
      return true;
    } catch (err) {
      downloadError.value =
        err instanceof Error
          ? err.message
          : 'Не удалось скачать или запустить установку APK.';
      return false;
    } finally {
      await progressHandle?.remove().catch(() => {});
      downloadingUpdate.value = false;
    }
  }

  return {
    availableUpdate,
    showUpdateBanner,
    checkingUpdates,
    updateCheckError,
    downloadingUpdate,
    downloadProgress,
    downloadIndeterminate,
    downloadError,
    checkForUpdateQuietly,
    checkForUpdateManual,
    dismissUpdateBanner,
    downloadAndInstallUpdate,
  };
}
