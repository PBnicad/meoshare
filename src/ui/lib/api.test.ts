import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('gets user via request helper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'u1@example.com' } }),
      })
    );

    const result = await api.getUser();
    expect(result.user.id).toBe('u1');
    expect(fetch).toHaveBeenCalledWith('/api/user', expect.objectContaining({ credentials: 'include' }));
  });

  it('throws backend message for request failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
      })
    );

    await expect(api.getFiles()).rejects.toThrow('Unauthorized');
  });

  it('uploads file with form data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ fileId: 'f1', filename: 'a.txt', size: 1, expiresAt: 'x', downloadUrl: '/f/f1' }),
      })
    );

    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    const result = await api.uploadFile(file, 7);
    expect(result.fileId).toBe('f1');
    expect(fetch).toHaveBeenCalledWith('/api/file/upload', expect.objectContaining({ method: 'POST' }));
  });

  it('throws backend error for upload failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Upload failed custom' }),
      })
    );

    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFile(file, 7)).rejects.toThrow('Upload failed custom');
  });

  it('uploads file with progress through xhr', async () => {
    class MockXHR {
      upload = {
        addEventListener: vi.fn((event: string, cb: any) => {
          if (event === 'progress') {
            this.onProgress = cb;
          }
        }),
      };

      onLoad: any;
      onError: any;
      onAbort: any;
      onProgress: any;
      status = 200;
      responseText = JSON.stringify({ fileId: 'f1', filename: 'a.txt', size: 1, expiresAt: 'x', downloadUrl: '/f/f1' });
      withCredentials = false;

      addEventListener(event: string, cb: any) {
        if (event === 'load') this.onLoad = cb;
        if (event === 'error') this.onError = cb;
        if (event === 'abort') this.onAbort = cb;
      }

      open = vi.fn();
      send = vi.fn(() => {
        this.onProgress?.({ lengthComputable: true, loaded: 5, total: 10 });
        this.onLoad?.();
      });
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);

    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    const onProgress = vi.fn();
    const result = await api.uploadFileWithProgress(file, 3, onProgress);
    expect(result.fileId).toBe('f1');
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('throws cancel error on xhr abort', async () => {
    class MockXHR {
      upload = { addEventListener: vi.fn() };
      onAbort: any;
      addEventListener(event: string, cb: any) {
        if (event === 'abort') this.onAbort = cb;
      }
      open = vi.fn();
      send = vi.fn(() => this.onAbort?.());
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFileWithProgress(file, 3, vi.fn())).rejects.toThrow('Upload cancelled');
  });
});
