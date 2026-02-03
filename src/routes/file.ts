import { Hono } from 'hono';
import type { Env } from '../lib/auth';
import { getSessionFromCookie } from '../middleware/session';
import * as fileService from '../services/file';
import { downloadFileFromR2, deleteFileFromR2 } from '../services/r2';

const fileRoutes = new Hono<{ Bindings: Env }>();

// 上传文件
fileRoutes.post('/upload', async (c) => {
  const session = await getSessionFromCookie(c, c.env.DB);

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const expiresIn = parseInt(formData.get('expiresIn') as string) || 7; // 默认7天

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // 检查文件大小 (Cloudflare Workers 免费套餐限制 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      }, 400);
    }

    if (expiresIn < 1 || expiresIn > 30) {
      return c.json({ error: 'Expiration time must be between 1 and 30 days' }, 400);
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const r2Key = `${session.user.id}/${Date.now()}-${file.name}`;

    // 上传到 R2
    await c.env.R2.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // 创建数据库记录
    const fileId = await fileService.createFileRecord(c.env.DB, {
      userId: session.user.id,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      expiresAt,
      r2Key,
    });

    return c.json({
      fileId,
      filename: file.name,
      size: file.size,
      expiresAt: expiresAt.toISOString(),
      downloadUrl: `/f/${fileId}`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// 删除文件
fileRoutes.delete('/:id', async (c) => {
  const session = await getSessionFromCookie(c, c.env.DB);

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const fileId = c.req.param('id');

  try {
    // 获取文件信息
    const file = await fileService.getFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    // 检查权限
    if (file.user_id !== session.user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // 从 R2 删除
    await deleteFileFromR2(c.env.R2, file.r2_key);

    // 从数据库删除
    await fileService.deleteFileRecord(c.env.DB, fileId, session.user.id);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Failed to delete file' }, 500);
  }
});

// 获取文件信息 (公开)
fileRoutes.get('/:id', async (c) => {
  const fileId = c.req.param('id');

  try {
    const file = await fileService.getFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    // 检查是否过期
    const expired = await fileService.isFileExpired(c.env.DB, fileId);
    if (expired) {
      return c.json({ error: 'File has expired' }, 410);
    }

    return c.json({
      id: file.id,
      filename: file.filename,
      contentType: file.content_type,
      size: file.size,
      expiresAt: file.expires_at,
      downloadCount: file.download_count,
      createdAt: file.created_at,
      uploader: {
        name: file.name,
        avatar: file.avatar,
      },
    });
  } catch (error) {
    console.error('Get file error:', error);
    return c.json({ error: 'Failed to get file info' }, 500);
  }
});

// 文件下载 (实际文件)
fileRoutes.get('/:id/download', async (c) => {
  const fileId = c.req.param('id');

  try {
    const file = await fileService.getFileById(c.env.DB, fileId);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    // 检查是否过期
    const expired = await fileService.isFileExpired(c.env.DB, fileId);
    if (expired) {
      return c.json({ error: 'File has expired' }, 410);
    }

    // 从 R2 获取文件
    const object = await c.env.R2.get(file.r2_key);

    if (!object) {
      return c.json({ error: 'File not found in storage' }, 404);
    }

    // 增加下载计数
    await fileService.incrementDownloadCount(c.env.DB, fileId);

    // 返回文件
    return new Response(object.body, {
      headers: {
        'Content-Type': file.content_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Content-Length': file.size.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'Failed to download file' }, 500);
  }
});

export { fileRoutes };
