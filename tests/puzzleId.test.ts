import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/ui/PuzzleId';

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports success only after the clipboard write resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('v1-one-t4-abc')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('v1-one-t4-abc');
  });

  it('reports failure when the write is rejected or the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await expect(copyText('x')).resolves.toBe(false);
    vi.stubGlobal('navigator', {});
    await expect(copyText('x')).resolves.toBe(false);
  });
});
