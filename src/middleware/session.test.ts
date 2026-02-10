import { describe, expect, it, vi } from 'vitest';
import { getSessionFromCookie } from './session';

describe('session middleware', () => {
  function createContext(cookie: string | null) {
    return {
      req: {
        raw: {
          headers: {
            get: vi.fn().mockReturnValue(cookie),
          },
        },
      },
    };
  }

  it('returns null when cookie header is missing', async () => {
    const c = createContext(null);
    const db = { prepare: vi.fn() };
    await expect(getSessionFromCookie(c, db as any)).resolves.toBeNull();
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('returns null when session token is missing', async () => {
    const c = createContext('foo=bar');
    const db = { prepare: vi.fn() };
    await expect(getSessionFromCookie(c, db as any)).resolves.toBeNull();
  });

  it('returns null when session does not exist', async () => {
    const stmt = {
      bind: vi.fn(),
      first: vi.fn().mockResolvedValue(null),
    };
    stmt.bind.mockReturnValue(stmt);
    const db = {
      prepare: vi.fn().mockReturnValue(stmt),
    };

    const c = createContext('meoshare_session.token=s1');
    await expect(getSessionFromCookie(c, db as any)).resolves.toBeNull();
  });

  it('returns normalized session data for valid session', async () => {
    const stmt = {
      bind: vi.fn(),
      first: vi.fn().mockResolvedValue({
        id: 's1',
        userId: 'u1',
        email: 'u1@example.com',
        name: 'U1',
        image: null,
      }),
    };
    stmt.bind.mockReturnValue(stmt);
    const db = {
      prepare: vi.fn().mockReturnValue(stmt),
    };

    const c = createContext('a=b; meoshare_session.token=s1; c=d');
    const session = await getSessionFromCookie(c, db as any);
    expect(session).toEqual({
      user: {
        id: 'u1',
        email: 'u1@example.com',
        name: 'U1',
        image: null,
      },
      sessionId: 's1',
    });
  });
});
