import { beforeEach, describe, expect, it, vi } from 'vitest';
import app, { scheduled } from './index';
import * as fileService from '../services/file';

vi.mock('../services/file', () => ({
  getFileById: vi.fn(),
  isFileExpired: vi.fn(),
  cleanupExpiredFiles: vi.fn(),
}));

describe('index routes', () => {
  const env = { DB: {}, R2: {} } as any;

  beforeEach(() => {
    vi.mocked(fileService.getFileById).mockReset();
    vi.mocked(fileService.isFileExpired).mockReset();
    vi.mocked(fileService.cleanupExpiredFiles).mockReset();
  });

  it('returns 404 html when shared file is missing', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue(null);
    const res = await app.request('/f/f1', {}, env);
    expect(res.status).toBe(404);
    await expect(res.text()).resolves.toContain('File not found');
  });

  it('returns 410 html when shared file is expired', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue({ id: 'f1' } as any);
    vi.mocked(fileService.isFileExpired).mockResolvedValue(true);
    const res = await app.request('/f/f1', {}, env);
    expect(res.status).toBe(410);
    await expect(res.text()).resolves.toContain('File has expired');
  });

  it('returns download page html', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue({
      id: 'f1',
      filename: 'a.txt',
      size: 1048576,
      expires_at: '2999-01-01T00:00:00.000Z',
      name: 'u1',
    } as any);
    vi.mocked(fileService.isFileExpired).mockResolvedValue(false);

    const res = await app.request('/f/f1', {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a.txt - MeoShare');
    expect(html).toContain('/api/file/f1/download');
  });

  it('returns download page with Anonymous when uploader name is null', async () => {
    vi.mocked(fileService.getFileById).mockResolvedValue({
      id: 'f1',
      filename: 'a.txt',
      size: 1048576,
      expires_at: '2999-01-01T00:00:00.000Z',
      name: null,
    } as any);
    vi.mocked(fileService.isFileExpired).mockResolvedValue(false);

    const res = await app.request('/f/f1', {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Anonymous');
  });

  it('runs scheduled cleanup', async () => {
    vi.mocked(fileService.cleanupExpiredFiles).mockResolvedValue(3);
    await scheduled({ scheduledTime: Date.now(), cron: '* * * * *' }, env, {} as any);
    expect(fileService.cleanupExpiredFiles).toHaveBeenCalledWith(env.DB, env.R2);
  });

  it('handles errors when fetching download page', async () => {
    vi.mocked(fileService.getFileById).mockRejectedValue(new Error('DB error'));
    const res = await app.request('/f/f1', {}, env);
    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toContain('Server error');
  });
});
