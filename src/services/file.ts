/**
 * 创建文件记录
 */
export async function createFileRecord(
  db: D1Database,
  data: {
    userId: string;
    filename: string;
    contentType: string;
    size: number;
    expiresAt: Date;
    r2Key: string;
  }
): Promise<string> {
  const id = crypto.randomUUID();

  const result = await db
    .prepare(
      `INSERT INTO files (id, user_id, filename, content_type, size, r2_key, expires_at, download_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    )
    .bind(
      id,
      data.userId,
      data.filename,
      data.contentType,
      data.size,
      data.r2Key,
      data.expiresAt.toISOString()
    )
    .run();

  if (!result.success) {
    throw new Error('Failed to create file record');
  }

  return id;
}

/**
 * 通过 ID 获取文件记录
 */
export async function getFileById(db: D1Database, fileId: string): Promise<any> {
  const result = await db
    .prepare(
      `SELECT f.*, u.email, u.name, u.image as avatar
       FROM files f
       JOIN user u ON f.user_id = u.id
       WHERE f.id = ?`
    )
    .bind(fileId)
    .first();

  return result;
}

/**
 * 获取用户的所有文件
 */
export async function getUserFiles(db: D1Database, userId: string): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT * FROM files
       WHERE user_id = ?
       AND expires_at > datetime('now')
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return result.results || [];
}

/**
 * 删除文件记录
 */
export async function deleteFileRecord(db: D1Database, fileId: string, userId: string): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM files WHERE id = ? AND user_id = ?`)
    .bind(fileId, userId)
    .run();

  return result.success && (result.meta?.changes || 0) > 0;
}

/**
 * 增加文件下载计数
 */
export async function incrementDownloadCount(db: D1Database, fileId: string): Promise<void> {
  await db
    .prepare(`UPDATE files SET download_count = download_count + 1 WHERE id = ?`)
    .bind(fileId)
    .run();
}

/**
 * 检查文件是否过期
 */
export async function isFileExpired(db: D1Database, fileId: string): Promise<boolean> {
  const result = await db
    .prepare(`SELECT expires_at FROM files WHERE id = ?`)
    .bind(fileId)
    .first();

  if (!result) return true;

  const expiresAt = new Date(result.expires_at as string);
  return expiresAt < new Date();
}

/**
 * 清理过期文件 (Cron Job)
 */
export async function cleanupExpiredFiles(db: D1Database, r2: R2Bucket): Promise<number> {
  // 获取所有过期文件
  const result = await db
    .prepare(`SELECT id, r2_key FROM files WHERE expires_at <= datetime('now')`)
    .all();

  const expiredFiles = result.results || [];
  let deletedCount = 0;

  for (const file of expiredFiles) {
    try {
      // 从 R2 删除文件
      await r2.delete(file.r2_key as string);

      // 从数据库删除记录
      await db.prepare(`DELETE FROM files WHERE id = ?`).bind(file.id).run();

      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete expired file ${file.id}:`, error);
    }
  }

  return deletedCount;
}
