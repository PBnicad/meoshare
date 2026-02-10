import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userRoutes } from './user';
import { getSessionFromCookie } from '../middleware/session';
import * as fileService from '../services/file';

vi.mock('../middleware/session', () => ({
  getSessionFromCookie: vi.fn(),
}));

vi.mock('../services/file', () => ({
  getUserFiles: vi.fn(),
}));

describe('user routes', () => {
  const app = new Hono();
  app.route('/api/user', userRoutes);
  const env = { DB: {} } as any;

  beforeEach(() => {
    vi.mocked(getSessionFromCookie).mockReset();
    vi.mocked(fileService.getUserFiles).mockReset();
  });

  it('returns 401 for unauthenticated /api/user', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);
    const res = await app.request('/api/user', {}, env);
    expect(res.status).toBe(401);
  });

  it('returns current user', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({
      sessionId: 's1',
      user: { id: 'u1', email: 'u1@example.com', name: null, image: null },
    });
    const res = await app.request('/api/user', {}, env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { id: 'u1', email: 'u1@example.com', name: null, image: null },
    });
  });

  it('returns user files', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({
      sessionId: 's1',
      user: { id: 'u1', email: 'u1@example.com', name: null, image: null },
    });
    vi.mocked(fileService.getUserFiles).mockResolvedValue([{ id: 'f1' }] as any);

    const res = await app.request('/api/user/files', {}, env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ files: [{ id: 'f1' }] });
  });
});
