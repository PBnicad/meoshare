import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authRoutes } from './auth';
import { getSessionFromCookie } from '../middleware/session';

vi.mock('../middleware/session', () => ({
  getSessionFromCookie: vi.fn(),
}));

describe('auth routes', () => {
  const app = new Hono();
  app.route('/api/auth', authRoutes);

  let env: any;
  let dbStmt: any;

  beforeEach(() => {
    dbStmt = {
      bind: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn(),
    };
    dbStmt.bind.mockReturnValue(dbStmt);
    env = {
      DB: {
        prepare: vi.fn().mockReturnValue(dbStmt),
      },
      APP_URL: 'http://localhost:8787',
      GITHUB_CLIENT_ID: 'cid',
      GITHUB_CLIENT_SECRET: 'secret',
    };
    vi.mocked(getSessionFromCookie).mockReset();
  });

  it('redirects to github signin', async () => {
    const res = await app.request('/api/auth/signin/github', {}, env);
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') || '';
    expect(location).toContain('https://github.com/login/oauth/authorize?');
    expect(location).toContain('client_id=cid');
  });

  it('redirects callback when code is missing', async () => {
    const res = await app.request('/api/auth/callback/github', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/?error=no_code');
  });

  it('returns 401 for session endpoint when not logged in', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);
    const res = await app.request('/api/auth/session', {}, env);
    expect(res.status).toBe(401);
  });

  it('returns current user on session endpoint', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({
      sessionId: 's1',
      user: { id: 'u1', email: 'u1@example.com', name: null, image: null },
    });

    const res = await app.request('/api/auth/session', {}, env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { id: 'u1', email: 'u1@example.com', name: null, image: null },
    });
  });

  it('signs out and clears cookie', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue({
      sessionId: 's1',
      user: { id: 'u1', email: 'u1@example.com', name: null, image: null },
    });

    const res = await app.request('/api/auth/signout', { method: 'POST' }, env);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalled();
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
