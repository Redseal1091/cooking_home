import { Preferences } from '@capacitor/preferences';

export const APP_VERSION = '1.3.2';

const ENV_GITHUB_REPO = (
  (import.meta.env.VITE_GITHUB_REPO as string | undefined) ?? ''
).trim();

export const HAS_ENV_GITHUB_REPO = ENV_GITHUB_REPO.length > 0;
export const DEFAULT_GITHUB_REPO = ENV_GITHUB_REPO || 'Redseal1091/cooking_home';

const GITHUB_REPO_PREF_KEY = 'pukhnya_github_repo_v1';

export function normalizeGithubRepo(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

export async function loadSavedGithubRepo(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: GITHUB_REPO_PREF_KEY });
    const clean = value ? normalizeGithubRepo(value) : '';
    if (clean && clean.includes('/')) {
      return clean;
    }
  } catch {
    // ignore
  }
  return DEFAULT_GITHUB_REPO;
}

export async function saveGithubRepo(repo: string): Promise<string> {
  const clean = normalizeGithubRepo(repo);
  try {
    if (!clean) {
      await Preferences.remove({ key: GITHUB_REPO_PREF_KEY });
      return DEFAULT_GITHUB_REPO;
    }
    await Preferences.set({ key: GITHUB_REPO_PREF_KEY, value: clean });
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
  apkDownloadUrl: string;
  apkFileName: string;
  htmlUrl: string;
  isPrerelease: boolean;
}

interface GithubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GithubReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GithubReleaseAsset[];
}

export async function checkGithubLatestRelease(repo: string): Promise<ReleaseUpdateInfo> {
  const cleanRepo = normalizeGithubRepo(repo);
  if (!/^[^/\s]+\/[^/\s]+$/.test(cleanRepo)) {
    throw new Error('Укажите репозиторий GitHub в формате owner/repo (например: Redseal1091/cooking_home).');
  }

  const headers = {
    Accept: 'application/vnd.github+json',
  };

  let releaseData: GithubReleaseResponse | null = null;

  const latestRes = await fetch(
    `https://api.github.com/repos/${cleanRepo}/releases/latest`,
    { headers },
  );

  if (latestRes.ok) {
    releaseData = (await latestRes.json()) as GithubReleaseResponse;
  } else if (latestRes.status === 404) {
    // Fallback на список всех релизов (например, если релиз отмечен как Pre-release)
    const listRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/releases?per_page=10`,
      { headers },
    );

    if (listRes.status === 404) {
      throw new Error(
        `Репозиторий «${cleanRepo}» не найден или он приватный. Проверьте адрес owner/repo.`,
      );
    }
    if (listRes.status === 401 || listRes.status === 403) {
      throw new Error(
        `GitHub API отклонил запрос (HTTP ${listRes.status}). Репозиторий приватный или превышен лимит запросов.`,
      );
    }
    if (!listRes.ok) {
      throw new Error(`Ошибка проверки релизов на GitHub (HTTP ${listRes.status}).`);
    }

    const list = (await listRes.json()) as GithubReleaseResponse[];
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`В репозитории «${cleanRepo}» ещё не опубликовано ни одного релиза.`);
    }

    releaseData = list.find((r) => !r.draft) ?? list[0];
  } else if (latestRes.status === 401 || latestRes.status === 403) {
    throw new Error(
      `GitHub API отклонил запрос (HTTP ${latestRes.status}). Репозиторий приватный или превышен лимит запросов.`,
    );
  } else {
    throw new Error(`Не удалось проверить обновления на GitHub (HTTP ${latestRes.status}).`);
  }

  if (!releaseData) {
    throw new Error(`В репозитории «${cleanRepo}» не найден доступный релиз.`);
  }

  const tag = (releaseData.tag_name || releaseData.name || APP_VERSION).trim();
  const latestVersion = tag.replace(/^v/i, '');

  const assets = Array.isArray(releaseData.assets) ? releaseData.assets : [];
  const apkAsset = assets.find((a) => (a.name ?? '').toLowerCase().endsWith('.apk'));

  if (!apkAsset?.browser_download_url) {
    throw new Error(`В релизе «${tag}» не найден прикреплённый .apk файл.`);
  }

  const isNewer = compareVersions(latestVersion, APP_VERSION) > 0;

  return {
    hasUpdate: isNewer,
    latestVersion,
    releaseName: releaseData.name || tag,
    changelog: (releaseData.body || '').trim(),
    apkDownloadUrl: apkAsset.browser_download_url,
    apkFileName: apkAsset.name || `pukhnya-${latestVersion}.apk`,
    htmlUrl: releaseData.html_url || `https://github.com/${cleanRepo}/releases`,
    isPrerelease: Boolean(releaseData.prerelease),
  };
}
