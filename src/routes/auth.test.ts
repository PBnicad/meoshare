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

  it('signs out successfully when no session exists', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);

    const res = await app.request('/api/auth/signout', { method: 'POST' }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  describe('GitHub callback', () => {
    it('handles successful oauth callback for new user', async () => {
      globalThis.fetch = vi.fn();

      // Mock token response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gh_token' }),
      } as Response);

      // Mock user response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        }),
      } as Response);

      // Mock emails response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ primary: true, email: 'test@example.com' }],
      } as Response);

      // No existing user
      dbStmt.first.mockResolvedValueOnce(null);

      // No existing account
      dbStmt.first.mockResolvedValueOnce(null);

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        env
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('/?t=');
      expect(res.headers.get('Set-Cookie')).toContain('meoshare_session.token=');
    });

    it('handles successful oauth callback for existing user', async () => {
      globalThis.fetch = vi.fn();

      // Mock token response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gh_token' }),
      } as Response);

      // Mock user response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        }),
      } as Response);

      // Mock emails response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ primary: true, email: 'test@example.com' }],
      } as Response);

      // Existing user
      dbStmt.first.mockResolvedValueOnce({ id: 'existing_user_id' });

      // No existing account
      dbStmt.first.mockResolvedValueOnce(null);

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        env
      );

      expect(res.status).toBe(302);
    });

    it('handles successful oauth callback when account already exists', async () => {
      globalThis.fetch = vi.fn();

      // Mock token response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gh_token' }),
      } as Response);

      // Mock user response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        }),
      } as Response);

      // Mock emails response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ primary: true, email: 'test@example.com' }],
      } as Response);

      // No existing user
      dbStmt.first.mockResolvedValueOnce(null);

      // Existing account
      dbStmt.first.mockResolvedValueOnce({ id: 'existing_account_id' });

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        env
      );

      expect(res.status).toBe(302);
    });

    it('handles token request failure', async () => {
      globalThis.fetch = vi.fn();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_code',
      } as Response);

      const res = await app.request(
        '/api/auth/callback/github?code=invalid_code',
        {},
        env
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=auth_error');
    });

    it('handles user info request failure', async () => {
      globalThis.fetch = vi.fn();

      // Mock token response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gh_token' }),
      } as Response);

      // Mock user response failure
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
      } as Response);

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        env
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=auth_error');
    });

    it('handles oauth callback error', async () => {
      globalThis.fetch = vi.fn();

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        env
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=auth_error');
    });

    it('sets secure cookie when using https', async () => {
      globalThis.fetch = vi.fn();

      const httpsEnv = { ...env, APP_URL: 'https://example.com' };

      // Mock token response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gh_token' }),
      } as Response);

      // Mock user response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        }),
      } as Response);

      // Mock emails response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ primary: true, email: 'test@example.com' }],
      } as Response);

      // No existing user
      dbStmt.first.mockResolvedValueOnce(null);

      // No existing account
      dbStmt.first.mockResolvedValueOnce(null);

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        httpsEnv
      );

      expect(res.status).toBe(302);
      const cookie = res.headers.get('Set-Cookie') || '';
      expect(cookie).toContain('Secure');
    });

    it('handles callback when user has no email', async () => {
      globalThis.fetch = vi.fn();

      // Mock token response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gh_token' }),
      } as Response);

      // Mock user response - no email field
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        }),
      } as Response);

      // Mock emails response - empty array
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      // No existing user
      dbStmt.first.mockResolvedValueOnce(null);

      // No existing account
      dbStmt.first.mockResolvedValueOnce(null);

      const res = await app.request(
        '/api/auth/callback/github?code=test_code',
        {},
        env
      );

      expect(res.status).toBe(302);
    });
  });
});
