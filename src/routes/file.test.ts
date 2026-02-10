// @vitest-environment node
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileRoutes } from './file';
import { getSessionFromCookie } from '../middleware/session';
import * as fileService from '../services/file';
import { deleteFileFromR2 } from '../services/r2';

vi.mock('../middleware/session', () => ({
  getSessionFromCookie: vi.fn(),
}));

vi.mock('../services/file', () => ({
  createFileRecord: vi.fn(),
  getFileById: vi.fn(),
  deleteFileRecord: vi.fn(),
  isFileExpired: vi.fn(),
  incrementDownloadCount: vi.fn(),
}));

vi.mock('../services/r2', () => ({
  deleteFileFromR2: vi.fn(),
  downloadFileFromR2: vi.fn(),
}));

describe('file routes', () => {
  const app = new Hono();
  app.route('/api/file', fileRoutes);

  let env: any;

  beforeEach(() => {
    env = {
      DB: {},
      R2: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ body: 'file-content' }),
      },
    };
    vi.mocked(getSessionFromCookie).mockReset();
    vi.mocked(fileService.createFileRecord).mockReset();
    vi.mocked(fileService.getFileById).mockReset();
    vi.mocked(fileService.deleteFileRecord).mockReset();
    vi.mocked(fileService.isFileExpired).mockReset();
    vi.mocked(fileService.incrementDownloadCount).mockReset();
    vi.mocked(deleteFileFromR2).mockReset();
  });

  it('rejects upload when unauthorized', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);
    const res = await app.request('/api/file/upload', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });

  it('rejects upload when no file is provided', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({ user: { id: 'u1' }, sessionId: 's1' } as any);
    const body = new FormData();
    body.set('expiresIn', '7');

    const res = await app.request('/api/file/upload', { method: 'POST', body }, env);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'No file provided' });
  });

  it('rejects upload when expiration is invalid', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({ user: { id: 'u1' }, sessionId: 's1' } as any);
    const body = new FormData();
    body.set('file', new File(['a'], 'a.txt', { type: 'text/plain' }));
    body.set('expiresIn', '31');

    const res = await app.request('/api/file/upload', { method: 'POST', body }, env);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Expiration time must be between 1 and 30 days' });
  });

  it('uploads file successfully', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({ user: { id: 'u1' }, sessionId: 's1' } as any);
    vi.mocked(fileService.createFileRecord).mockResolvedValue('f1');

    const body = new FormData();
    body.set('file', new File(['hello'], 'a.txt', { type: 'text/plain' }));
    body.set('expiresIn', '7');

    const res = await app.request('/api/file/upload', { method: 'POST', body }, env);
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.fileId).toBe('f1');
    expect(env.R2.put).toHaveBeenCalledOnce();
  });

  it('deletes file successfully for owner', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({ user: { id: 'u1' }, sessionId: 's1' } as any);
    vi.mocked(fileService.getFileById).mockResolvedValue({ id: 'f1', user_id: 'u1', r2_key: 'k1' } as any);
    vi.mocked(fileService.deleteFileRecord).mockResolvedValue(true);

    const res = await app.request('/api/file/f1', { method: 'DELETE' }, env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(deleteFileFromR2).toHaveBeenCalledWith(env.R2, 'k1');
  });

  it('returns 403 when deleting others file', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({ user: { id: 'u1' }, sessionId: 's1' } as any);
    vi.mocked(fileService.getFileById).mockResolvedValue({ id: 'f1', user_id: 'u2', r2_key: 'k1' } as any);

    const res = await app.request('/api/file/f1', { method: 'DELETE' }, env);
    expect(res.status).toBe(403);
  });

  it('returns file info', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue({
      id: 'f1',
      filename: 'a.txt',
      content_type: 'text/plain',
      size: 1,
      expires_at: '2999-01-01T00:00:00.000Z',
      download_count: 2,
      created_at: '2026-01-01T00:00:00.000Z',
      name: 'u1',
      avatar: 'img',
    } as any);
    vi.mocked(fileService.isFileExpired).mockResolvedValue(false);

    const res = await app.request('/api/file/f1', {}, env);
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.id).toBe('f1');
    expect(json.uploader.name).toBe('u1');
  });

  it('returns 410 for expired file info', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue({ id: 'f1' } as any);
    vi.mocked(fileService.isFileExpired).mockResolvedValue(true);

    const res = await app.request('/api/file/f1', {}, env);
    expect(res.status).toBe(410);
  });

  it('downloads file and increments count', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue({
      id: 'f1',
      filename: 'a.txt',
      content_type: 'text/plain',
      size: 12,
      r2_key: 'k1',
    } as any);
    vi.mocked(fileService.isFileExpired).mockResolvedValue(false);

    const res = await app.request('/api/file/f1/download', {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('a.txt');
    expect(fileService.incrementDownloadCount).toHaveBeenCalledWith(env.DB, 'f1');
  });
});
