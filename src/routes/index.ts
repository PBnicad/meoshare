import { Hono } from 'hono';
import type { Env } from '../lib/auth';
import { authRoutes } from './auth';
import { userRoutes } from './user';
import { fileRoutes } from './file';
import * as fileService from '../services/file';

const app = new Hono<{ Bindings: Env }>();

// 注册路由
app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/file', fileRoutes);

// 文件下载页面 (HTML)
app.get('/f/:id', async (c) => {
  const fileId = c.req.param('id');

  try {
    const file = await fileService.getFileById(c.env.DB, fileId);

    if (!file) {
      return c.html('<h1>File not found</h1>', 404);
    }

    // 检查是否过期
    const expired = await fileService.isFileExpired(c.env.DB, fileId);
    if (expired) {
      return c.html('<h1>File has expired</h1>', 410);
    }

    // 返回下载页面 HTML
    return c.html(`
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${file.filename} - MeoShare</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#121212] text-white min-h-screen flex items-center justify-center">
          <div class="max-w-2xl w-full p-8">
            <div class="bg-[#1E1E1E] rounded-lg p-8">
              <h1 class="text-2xl font-bold mb-4">${file.filename}</h1>
              <div class="space-y-2 text-gray-400 mb-6">
                <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>Uploaded by: ${file.name || 'Anonymous'}</p>
                <p>Expires: ${new Date(file.expires_at).toLocaleString()}</p>
              </div>
              <a href="/api/file/${fileId}/download"
                 class="block w-full bg-blue-500 hover:bg-blue-600 text-white text-center py-3 rounded-lg font-medium transition">
                Download File
              </a>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Download page error:', error);
    return c.html('<h1>Server error</h1>', 500);
  }
});

// 清理过期文件 (Cron Trigger)
export interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

export async function scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  const deletedCount = await fileService.cleanupExpiredFiles(env.DB, env.R2);
  console.log(`Cleaned up ${deletedCount} expired files`);
}

export default app;
