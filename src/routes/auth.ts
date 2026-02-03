import { Hono } from 'hono';
import type { Env } from '../lib/auth';
import { getSessionFromCookie } from '../middleware/session';

const authRoutes = new Hono<{ Bindings: Env }>();

// GitHub 登录
authRoutes.get('/signin/github', (c) => {
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.APP_URL}/api/auth/callback/github`,
    scope: 'read:user user:email',
    response_type: 'code',
    state: crypto.randomUUID(),
  });

  const githubUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return c.redirect(githubUrl);
});

// GitHub OAuth 回调
authRoutes.get('/callback/github', async (c) => {
  const code = c.req.query('code');

  if (!code) {
    return c.redirect('/?error=no_code');
  }

  try {
    // 1. 用 code 换取 access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('GitHub token error:', errorText);
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. 获取用户信息
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'MeoShare',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const githubUser = await userResponse.json();

    // 3. 获取邮箱
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'MeoShare',
      },
    });

    const emails = await emailsResponse.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email;

    // 4. 检查用户是否已存在
    const existingUser = await c.env.DB
      .prepare('SELECT * FROM user WHERE email = ?')
      .bind(primaryEmail || githubUser.email || githubUser.id.toString())
      .first();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // 创建新用户
      userId = crypto.randomUUID();
      await c.env.DB
        .prepare('INSERT INTO user (id, email, name, image, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(
          userId,
          primaryEmail || githubUser.email || `${githubUser.id}@github.local`,
          githubUser.name,
          githubUser.avatar_url,
          Date.now(),
          Date.now()
        )
        .run();
    }

    // 5. 创建 GitHub account 关联
    const existingAccount = await c.env.DB
      .prepare('SELECT * FROM account WHERE provider = ? AND accountId = ?')
      .bind('github', githubUser.id.toString())
      .first();

    if (!existingAccount) {
      await c.env.DB
        .prepare('INSERT INTO account (id, accountId, provider, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(
          crypto.randomUUID(),
          githubUser.id.toString(),
          'github',
          userId,
          Date.now(),
          Date.now()
        )
        .run();
    }

    // 6. 创建会话
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 60 * 60 * 24 * 7 * 1000; // 7 days

    await c.env.DB
      .prepare('INSERT INTO session (id, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .bind(
        sessionId,
        userId,
        expiresAt,
        Date.now(),
        Date.now()
      )
      .run();

    // 7. 设置 session cookie
    const isSecure = c.env.APP_URL.startsWith('https');
    const maxAge = 60 * 60 * 24 * 7;
    const cookie = `meoshare_session.token=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure ? '; Secure' : ''}`;

    c.header('Set-Cookie', cookie);
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.redirect('/?t=' + Date.now());
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.redirect('/?error=auth_error');
  }
});

// 获取当前会话
authRoutes.get('/session', async (c) => {
  const session = await getSessionFromCookie(c, c.env.DB);

  if (!session) {
    return c.json({ user: null }, 401);
  }

  return c.json({ user: session.user });
});

// 退出登录
authRoutes.post('/signout', async (c) => {
  const session = await getSessionFromCookie(c, c.env.DB);

  if (session) {
    await c.env.DB
      .prepare('DELETE FROM session WHERE id = ?')
      .bind(session.sessionId)
      .run();
  }

  return c.json({ success: true }, 200, {
    'Set-Cookie': 'meoshare_session.token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  });
});

export { authRoutes };
