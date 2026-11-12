import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface ApkDownloadProgressEvent {
  progress: number;
  downloadedBytes?: number;
  totalBytes?: number;
  indeterminate?: boolean;
}

export interface ApkInstallerPlugin {
  downloadAndInstall(options: {
    url: string;
    fileName?: string;
  }): Promise<{ started: boolean; filePath?: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: ApkDownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');
