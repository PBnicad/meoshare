import type { R2Bucket } from '@cloudflare/workers-types';

export interface FileMetadata {
  id: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
  r2Key: string;
  expiresAt: Date;
}

/**
 * 生成唯一的 R2 key
 */
export function generateR2Key(userId: string, filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = filename.split('.').pop() || '';
  const baseName = filename.replace(/\.[^/.]+$/, '');
  return `${userId}/${timestamp}-${random}-${baseName}.${extension}`;
}

/**
 * 上传文件到 R2
 */
export async function uploadFileToR2(
  bucket: R2Bucket,
  key: string,
  file: ArrayBuffer | Uint8Array | ReadableStream<any>,
  contentType: string
): Promise<void> {
  await bucket.put(key, file, {
    httpMetadata: {
      contentType,
    },
  });
}

/**
 * 从 R2 下载文件
 */
export async function downloadFileFromR2(
  bucket: R2Bucket,
  key: string
): Promise<R2ObjectBody | null> {
  const object = await bucket.get(key);
  return object;
}

/**
 * 删除 R2 中的文件
 */
export async function deleteFileFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

/**
 * 检查文件是否存在
 */
export async function fileExistsInR2(bucket: R2Bucket, key: string): Promise<boolean> {
  const object = await bucket.head(key);
  return object !== null;
}

/**
 * 生成 R2 Presigned URL (用于客户端直接上传)
 */
export function generatePresignedUploadUrl(
  bucket: R2Bucket,
  key: string,
  expiresIn: number = 3600
): string {
  // Cloudflare R2 支持 S3 兼容的 presigned URL
  // 注意: 这需要 R2 bucket 配置了公网访问或者使用 Cloudflare 的 R2 API
  // 在 Workers 中，通常直接处理上传而不是使用 presigned URL

  // 简化实现：返回上传端点
  // 实际实现需要根据 R2 的具体配置
  return `/api/upload-direct?key=${encodeURIComponent(key)}`;
}

/**
 * 获取文件的公开访问 URL
 */
export function getPublicFileUrl(fileId: string, baseUrl: string): string {
  return `${baseUrl}/f/${fileId}`;
}
