export const BUILD_ID: string = __BUILD_ID__;

export type UpdateCheck =
  | { readonly kind: 'current'; readonly build: string }
  | { readonly kind: 'available'; readonly build: string }
  | { readonly kind: 'error' };

/** Compares the running build with the deployed version.json. Never throws. */
export async function checkForUpdate(
  current: string = BUILD_ID,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<UpdateCheck> {
  try {
    const res = await fetchFn(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { kind: 'error' };
    const data: unknown = await res.json();
    const build = (data as { build?: unknown } | null)?.build;
    if (typeof build !== 'string' || build === '') return { kind: 'error' };
    return build === current ? { kind: 'current', build } : { kind: 'available', build };
  } catch {
    return { kind: 'error' };
  }
}

export function updateUrl(build: string): string {
  return `/?update=${encodeURIComponent(build)}`;
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
