import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyUpdate, checkForUpdate, cleanUpdateParam, updateUrl } from '../src/update';
import { UpdateControl } from '../src/ui/UpdateControl';

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === 'BAD') throw new SyntaxError('bad json');
      return body;
    },
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('checkForUpdate', () => {
  it('same build is current', async () => {
    expect(await checkForUpdate('a', fakeFetch({ build: 'a' }))).toEqual({ kind: 'current', build: 'a' });
  });
  it('different build is available', async () => {
    expect(await checkForUpdate('a', fakeFetch({ build: 'b' }))).toEqual({ kind: 'available', build: 'b' });
  });
  it.each([404, 500])('status %i is error', async (s) => {
    expect(await checkForUpdate('a', fakeFetch({ build: 'b' }, s))).toEqual({ kind: 'error' });
  });
  it('rejected fetch is error', async () => {
    const f = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    expect(await checkForUpdate('a', f)).toEqual({ kind: 'error' });
  });
  it('malformed JSON is error', async () => {
    expect(await checkForUpdate('a', fakeFetch('BAD'))).toEqual({ kind: 'error' });
  });
  it.each([{}, { build: '' }, { build: 5 }, null, 'x'])('bad build %j is error', async (body) => {
    expect(await checkForUpdate('a', fakeFetch(body))).toEqual({ kind: 'error' });
  });
  it('fetches once with no-store and cache-busting URL', async () => {
    const f = fakeFetch({ build: 'a' });
    await checkForUpdate('a', f);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f as any).mock.calls[0];
    expect(url.startsWith('/version.json?t=')).toBe(true);
    expect(init).toMatchObject({ cache: 'no-store' });
  });
});

describe('update URLs', () => {
  it('encodes the build', () => {
    expect(updateUrl('a b&c')).toBe('/?update=a%20b%26c');
  });
  it('the development preview checks and reloads under its own base, never the published game\'s', async () => {
    const f = fakeFetch({ build: 'dev-2' });
    expect(await checkForUpdate('dev-1', f, '/dev/')).toEqual({ kind: 'available', build: 'dev-2' });
    expect((f as any).mock.calls[0][0].startsWith('/dev/version.json?t=')).toBe(true);
    expect(updateUrl('dev-2', '/dev/')).toBe('/dev/?update=dev-2');
  });

  it('applyUpdate replaces location', () => {
    const replace = vi.fn();
    applyUpdate('x1', { replace });
    expect(replace).toHaveBeenCalledWith('/?update=x1');
  });
  it('cleanUpdateParam removes only update', () => {
    const replaceState = vi.fn();
    const hist = { state: null, replaceState } as unknown as History;
    cleanUpdateParam({ search: '?a=1&update=x&b=2', pathname: '/', hash: '#h' } as Location, hist);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?a=1&b=2#h');
  });
  it('cleanUpdateParam drops lone ? and ignores absent param', () => {
    const replaceState = vi.fn();
    const hist = { state: null, replaceState } as unknown as History;
    cleanUpdateParam({ search: '?update=x', pathname: '/', hash: '' } as Location, hist);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    replaceState.mockClear();
    cleanUpdateParam({ search: '?a=1', pathname: '/', hash: '' } as Location, hist);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('UpdateControl', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('renders idle without fetching', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const html = renderToStaticMarkup(createElement(UpdateControl));
    expect(f).not.toHaveBeenCalled();
    expect(html).toContain('data-build-id');
    expect(html).toContain('Build ');
    expect(html).toContain('data-action="check-updates"');
    expect(html).toContain('data-update-status="idle"');
  });
});
