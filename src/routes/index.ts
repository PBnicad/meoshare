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
            <!-- Header with branding -->
            <div class="text-center mb-6">
              <h2 class="text-xl font-bold text-emerald-500 mb-1">MeoShare</h2>
              <p class="text-sm text-gray-500">临时文件分享服务</p>
            </div>

            <div class="bg-[#1E1E1E] rounded-lg p-8">
              <h1 class="text-2xl font-bold mb-4">${file.filename}</h1>
              <div class="space-y-2 text-gray-400 mb-6">
                <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>Uploaded by: ${file.name || 'Anonymous'}</p>
                <p>Expires: ${new Date(file.expires_at).toLocaleString()}</p>
              </div>
              <a href="/api/file/${fileId}/download"
                 class="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center py-3 rounded-lg font-medium transition">
                Download File
              </a>
            </div>

            <!-- Footer -->
            <div class="text-center mt-6 text-xs text-gray-600 space-y-2">
              <a href="/" class="inline-flex items-center gap-1 hover:text-emerald-500 transition-colors">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6"/></svg>
                返回主页
              </a>
              <div class="flex items-center justify-center gap-4">
                <a href="https://github.com/PBnicad/meoshare" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 hover:text-emerald-500 transition-colors">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub
                </a>
                <span>© ${new Date().getFullYear()} MeoShare (喵喵快传)</span>
              </div>
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
