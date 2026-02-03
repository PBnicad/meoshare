import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './lib/auth';
import routes from './routes/index';

// 创建 Hono app
const app = new Hono<{ Bindings: Env }>();

// 中间件
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // 允许本地开发环境和配置的 APP_URL
      const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8787', 'http://localhost:5173'];
      if (!origin) return allowedOrigins[0]; // 允许同源请求
      if (allowedOrigins.includes(origin)) return origin;
      return origin; // 生产环境允许请求的来源
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 注册路由 (包含 API 路由、文件下载页面等)
app.route('/', routes);

// 导出 Cron Trigger
export { scheduled } from './routes/index';

// 静态资源服务 (SPA fallback)
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // API 路由返回 404
  if (path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404);
  }

  // 返回 index.html 用于 SPA
  const assets = c.env.ASSETS as Fetcher;
  if (assets) {
    try {
      const assetPath = path === '/' ? '/index.html' : path;
      const response = await assets.fetch(new URL(assetPath, c.req.url));
      if (response.status === 404) {
        // SPA fallback to index.html
        return assets.fetch(new URL('/index.html', c.req.url));
      }
      return response;
    } catch {
      // 如果 ASSETS 不可用，返回基本 HTML
    }
  }

  // 返回基本 HTML
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>MeoShare</title>
      </head>
      <body>
        <div id="root">Loading...</div>
      </body>
    </html>
  `);
});

// 导出 Worker
export default app;
