export const BUILD_ID: string = __BUILD_ID__;

/**
 * Where this build is served from (Vite's base): / for the published game, /dev/ for the development preview. Each
 * checks its own version.json and reloads its own page, so the preview never compares itself with production.
 */
const BASE: string = import.meta.env.BASE_URL;

export type UpdateCheck =
  | { readonly kind: 'current'; readonly build: string }
  | { readonly kind: 'available'; readonly build: string }
  | { readonly kind: 'error' };

/** Compares the running build with the deployed version.json. Never throws. */
export async function checkForUpdate(
  current: string = BUILD_ID,
  fetchFn: typeof fetch = globalThis.fetch,
  base: string = BASE,
): Promise<UpdateCheck> {
  try {
    const res = await fetchFn(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { kind: 'error' };
    const data: unknown = await res.json();
    const build = (data as { build?: unknown } | null)?.build;
    if (typeof build !== 'string' || build === '') return { kind: 'error' };
    return build === current ? { kind: 'current', build } : { kind: 'available', build };
  } catch {
    return { kind: 'error' };
  }
}

export function updateUrl(build: string, base: string = BASE): string {
  return `${base}?update=${encodeURIComponent(build)}`;
}

export function applyUpdate(build: string, loc: Pick<Location, 'replace'> = window.location): void {
  loc.replace(updateUrl(build));
}

/** Removes the ?update= parameter left by an applied update, keeping other params and hash. */
export function cleanUpdateParam(loc: Location = window.location, hist: History = window.history): void {
  const params = new URLSearchParams(loc.search);
  if (!params.has('update')) return;
  params.delete('update');
  const query = params.toString();
  hist.replaceState(hist.state, '', `${loc.pathname}${query ? `?${query}` : ''}${loc.hash}`);
}
