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

  it('throws default error when json parse fails in request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      })
    );

    await expect(api.getFiles()).rejects.toThrow('Request failed');
  });

  it('throws default error when response json has empty error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: '' }),
      })
    );

    await expect(api.getFiles()).rejects.toThrow('Request failed');
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

  it('throws default error when json parse fails in upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      })
    );

    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFile(file, 7)).rejects.toThrow('Upload failed');
  });

  it('throws default error when upload response json has empty error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: '' }),
      })
    );

    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFile(file, 7)).rejects.toThrow('Upload failed');
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

  it('handles xhr progress when length is not computable', async () => {
    class MockXHR {
      upload = {
        addEventListener: vi.fn((event: string, cb: any) => {
          if (event === 'progress') {
            this.onProgress = cb;
          }
        }),
      };

      onLoad: any;
      onProgress: any;
      status = 200;
      responseText = JSON.stringify({ fileId: 'f1', filename: 'a.txt', size: 1, expiresAt: 'x', downloadUrl: '/f/f1' });
      withCredentials = false;

      addEventListener(event: string, cb: any) {
        if (event === 'load') this.onLoad = cb;
      }

      open = vi.fn();
      send = vi.fn(() => {
        this.onProgress?.({ lengthComputable: false, loaded: 5, total: 0 });
        this.onLoad?.();
      });
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);

    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    const onProgress = vi.fn();
    const result = await api.uploadFileWithProgress(file, 3, onProgress);
    expect(result.fileId).toBe('f1');
    expect(onProgress).not.toHaveBeenCalled();
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

  it('throws error on xhr error event', async () => {
    class MockXHR {
      upload = { addEventListener: vi.fn() };
      onError: any;
      addEventListener(event: string, cb: any) {
        if (event === 'error') this.onError = cb;
      }
      open = vi.fn();
      send = vi.fn(() => this.onError?.());
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFileWithProgress(file, 3, vi.fn())).rejects.toThrow('Upload failed');
  });

  it('throws error when xhr response is not 200 and json is valid', async () => {
    class MockXHR {
      upload = { addEventListener: vi.fn() };
      onLoad: any;
      status = 400;
      responseText = JSON.stringify({ error: 'Bad request' });
      addEventListener(event: string, cb: any) {
        if (event === 'load') this.onLoad = cb;
      }
      open = vi.fn();
      send = vi.fn(() => this.onLoad?.());
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFileWithProgress(file, 3, vi.fn())).rejects.toThrow('Bad request');
  });

  it('throws default error when xhr response json has no error field', async () => {
    class MockXHR {
      upload = { addEventListener: vi.fn() };
      onLoad: any;
      status = 400;
      responseText = JSON.stringify({ message: 'Some error' });
      addEventListener(event: string, cb: any) {
        if (event === 'load') this.onLoad = cb;
      }
      open = vi.fn();
      send = vi.fn(() => this.onLoad?.());
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFileWithProgress(file, 3, vi.fn())).rejects.toThrow('Upload failed');
  });

  it('throws error when xhr response is 200 but json is invalid', async () => {
    class MockXHR {
      upload = { addEventListener: vi.fn() };
      onLoad: any;
      status = 200;
      responseText = 'invalid json{{{';
      addEventListener(event: string, cb: any) {
        if (event === 'load') this.onLoad = cb;
      }
      open = vi.fn();
      send = vi.fn(() => this.onLoad?.());
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFileWithProgress(file, 3, vi.fn())).rejects.toThrow('Failed to parse response');
  });

  it('throws error when xhr response is not 200 and json is invalid', async () => {
    class MockXHR {
      upload = { addEventListener: vi.fn() };
      onLoad: any;
      status = 400;
      responseText = 'invalid json{{{';
      addEventListener(event: string, cb: any) {
        if (event === 'load') this.onLoad = cb;
      }
      open = vi.fn();
      send = vi.fn(() => this.onLoad?.());
    }

    vi.stubGlobal('XMLHttpRequest', MockXHR as any);
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });
    await expect(api.uploadFileWithProgress(file, 3, vi.fn())).rejects.toThrow('Upload failed');
  });

  it('deletes file successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })
    );

    const result = await api.deleteFile('f1');
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/file/f1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('gets file info successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'f1',
          filename: 'a.txt',
          contentType: 'text/plain',
          size: 1,
          expiresAt: '2026-01-01',
          downloadCount: 0,
          createdAt: '2026-01-01',
          uploader: { name: 'user', avatar: 'avatar' },
        }),
      })
    );

    const result = await api.getFileInfo('f1');
    expect(result.id).toBe('f1');
    expect(result.uploader.name).toBe('user');
  });
});
