export const APP_VERSION = '1.1.0';
export const DEFAULT_GITHUB_REPO =
  (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() ||
  'Redseal1091/cooking_home';

const GITHUB_REPO_STORAGE_KEY = 'pukhnya_github_repo_v1';

export function getSavedGithubRepo(): string {
  try {
    const saved = localStorage.getItem(GITHUB_REPO_STORAGE_KEY)?.trim();
    if (saved && saved.includes('/')) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_GITHUB_REPO;
}

export function setSavedGithubRepo(repo: string): string {
  const clean = repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  try {
    if (!clean || clean === DEFAULT_GITHUB_REPO) {
      localStorage.removeItem(GITHUB_REPO_STORAGE_KEY);
    } else {
      localStorage.setItem(GITHUB_REPO_STORAGE_KEY, clean);
    }
  } catch {
    // ignore
  }
  return clean || DEFAULT_GITHUB_REPO;
}

/**
 * Сравнивает семантические версии: возвращает > 0 если `a > b`, 0 если равны, < 0 если `a < b`.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isNaN(n) ? 0 : n;
      });

  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export interface ReleaseUpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseName: string;
  changelog: string;
  apkDownloadUrl: string | null;
  apkFileName: string | null;
  htmlUrl: string;
}

interface GithubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GithubLatestReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  assets?: GithubReleaseAsset[];
}

export async function checkGithubLatestRelease(repo: string): Promise<ReleaseUpdateInfo> {
  const cleanRepo = repo.trim();
  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error('Укажите репозиторий в формате owner/repo');
  }

  const response = await fetch(
    `https://api.github.com/repos/${cleanRepo}/releases/latest`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (response.status === 404) {
    return {
      hasUpdate: false,
      latestVersion: APP_VERSION,
      releaseName: `v${APP_VERSION}`,
      changelog: '',
      apkDownloadUrl: null,
      apkFileName: null,
      htmlUrl: `https://github.com/${cleanRepo}/releases`,
    };
  }

  if (!response.ok) {
    throw new Error(`Не удалось проверить обновления (HTTP ${response.status})`);
  }

  const data = (await response.json()) as GithubLatestReleaseResponse;
  const tag = (data.tag_name || data.name || APP_VERSION).trim();
  const latestVersion = tag.replace(/^v/i, '');

  const assets = Array.isArray(data.assets) ? data.assets : [];
  const apkAsset = assets.find((a) => (a.name ?? '').toLowerCase().endsWith('.apk'));

  const isNewer = compareVersions(latestVersion, APP_VERSION) > 0;

  return {
    hasUpdate: isNewer && Boolean(apkAsset?.browser_download_url),
    latestVersion,
    releaseName: data.name || tag,
    changelog: (data.body || '').trim(),
    apkDownloadUrl: apkAsset?.browser_download_url ?? null,
    apkFileName: apkAsset?.name ?? null,
    htmlUrl: data.html_url || `https://github.com/${cleanRepo}/releases/latest`,
  };
}
