import { Hono } from 'hono';
import type { Env } from '../lib/auth';
import { getSessionFromCookie } from '../middleware/session';
import * as fileService from '../services/file';

const userRoutes = new Hono<{ Bindings: Env }>();

// 获取当前用户信息
userRoutes.get('/', async (c) => {
  const session = await getSessionFromCookie(c, c.env.DB);

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({ user: session.user });
});

// 获取用户的所有文件
userRoutes.get('/files', async (c) => {
  const session = await getSessionFromCookie(c, c.env.DB);

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const files = await fileService.getUserFiles(c.env.DB, session.user.id);
  return c.json({ files });
});

export { userRoutes };
