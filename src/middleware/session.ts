import type { Env } from '../lib/auth';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface AppSession {
  user: SessionUser;
  sessionId: string;
}

export async function getSessionFromCookie(c: any, db: D1Database): Promise<AppSession | null> {
  const cookieHeader = c.req.raw.headers.get('cookie');
  if (!cookieHeader) return null;

  // 解析 cookie
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie: string) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });

  const sessionId = cookies['meoshare_session.token'];
  if (!sessionId) return null;

  // 从数据库获取 session
  const session = await db
    .prepare(`
      SELECT s.*, u.id as userId, u.email, u.name, u.image
      FROM session s
      JOIN user u ON s.userId = u.id
      WHERE s.id = ? AND s.expiresAt > ?
    `)
    .bind(sessionId, Date.now())
    .first() as any;

  if (!session) return null;

  return {
    user: {
      id: String(session.userId),
      email: String(session.email),
      name: session.name as string | null,
      image: session.image as string | null,
    },
    sessionId: String(session.id),
  };
}
