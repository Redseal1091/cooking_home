package com.family.cookbook;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
    private static final String TAG = "ApkInstallerPlugin";
    private static final int MAX_REDIRECTS = 6;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isDownloading = new AtomicBoolean(false);

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("Не указана ссылка на APK-файл.");
            return;
        }

        if (!isDownloading.compareAndSet(false, true)) {
            call.reject("Загрузка обновления уже выполняется.");
            return;
        }

        String rawFileName = call.getString("fileName", "pukhnya-update.apk");
        String safeFileName = sanitizeFileName(rawFileName);
        String downloadUrl = rawUrl.trim();

        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                Context context = getContext();
                File updatesDir = new File(context.getCacheDir(), "updates");
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new IllegalStateException("Не удалось создать директорию кэша для обновления.");
                }

                // Удаляем старые скачанные APK из кэша
                File[] existing = updatesDir.listFiles();
                if (existing != null) {
                    for (File oldFile : existing) {
                        if (oldFile.isFile()) {
                            //noinspection ResultOfMethodCallIgnored
                            oldFile.delete();
                        }
                    }
                }

                File targetFile = new File(updatesDir, safeFileName);
                File tempFile = new File(updatesDir, safeFileName + ".part");

                emitProgress(0, 0, -1, false);
                connection = openConnectionFollowingRedirects(downloadUrl);

                int statusCode = connection.getResponseCode();
                if (statusCode < 200 || statusCode >= 300) {
                    throw new IllegalStateException("Сервер вернул ошибку HTTP " + statusCode);
                }

                long totalBytes = connection.getContentLengthLong();
                long downloadedBytes = 0;
                int lastPercent = -1;
                long lastEmitAt = 0;

                try (
                    InputStream in = new BufferedInputStream(connection.getInputStream());
                    FileOutputStream out = new FileOutputStream(tempFile)
                ) {
                    byte[] buffer = new byte[16 * 1024];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                        downloadedBytes += bytesRead;

                        long now = System.currentTimeMillis();
                        if (totalBytes > 0) {
                            int percent = (int) Math.min(99, Math.round((downloadedBytes * 100.0) / totalBytes));
                            if (percent != lastPercent && (percent - lastPercent >= 2 || now - lastEmitAt >= 120)) {
                                lastPercent = percent;
                                lastEmitAt = now;
                                emitProgress(percent, downloadedBytes, totalBytes, false);
                            }
                        } else if (now - lastEmitAt >= 200) {
                            lastEmitAt = now;
                            emitProgress(0, downloadedBytes, -1, true);
                        }
                    }
                    out.flush();
                }

                if (!tempFile.renameTo(targetFile)) {
                    throw new IllegalStateException("Не удалось подготовить файл обновления.");
                }

                emitProgress(100, downloadedBytes, totalBytes > 0 ? totalBytes : downloadedBytes, false);

                Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    targetFile
                );

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                context.startActivity(installIntent);

                JSObject result = new JSObject();
                result.put("started", true);
                result.put("filePath", targetFile.getAbsolutePath());
                call.resolve(result);
            } catch (Exception ex) {
                Log.e(TAG, "Failed to download/install APK", ex);
                call.reject(ex.getMessage() != null ? ex.getMessage() : "Не удалось скачать или запустить установку APK.");
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
                isDownloading.set(false);
            }
        });
    }

    private HttpURLConnection openConnectionFollowingRedirects(String initialUrl) throws Exception {
        String currentUrl = initialUrl;
        for (int hop = 0; hop < MAX_REDIRECTS; hop++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(currentUrl).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "Pukhnya-Android-Updater");
            conn.connect();

            int code = conn.getResponseCode();
            if (
                code == HttpURLConnection.HTTP_MOVED_PERM ||
                code == HttpURLConnection.HTTP_MOVED_TEMP ||
                code == HttpURLConnection.HTTP_SEE_OTHER ||
                code == 307 ||
                code == 308
            ) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.trim().isEmpty()) {
                    throw new IllegalStateException("Пустой redirect-адрес при скачивании APK.");
                }
                URL base = new URL(currentUrl);
                currentUrl = new URL(base, location).toString();
                continue;
            }
            return conn;
        }
        throw new IllegalStateException("Слишком много перенаправлений при скачивании APK.");
    }

    private void emitProgress(int progress, long downloadedBytes, long totalBytes, boolean indeterminate) {
        JSObject payload = new JSObject();
        payload.put("progress", progress);
        payload.put("downloadedBytes", downloadedBytes);
        payload.put("totalBytes", totalBytes);
        payload.put("indeterminate", indeterminate);
        notifyListeners("downloadProgress", payload);
    }

    private String sanitizeFileName(String raw) {
        String clean = (raw == null ? "pukhnya-update.apk" : raw.trim()).replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!clean.toLowerCase().endsWith(".apk")) {
            clean = clean + ".apk";
        }
        return clean;
    }
}
