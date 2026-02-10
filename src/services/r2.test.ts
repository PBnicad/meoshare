import { describe, expect, it, vi } from 'vitest';
import {
  deleteFileFromR2,
  downloadFileFromR2,
  fileExistsInR2,
  generatePresignedUploadUrl,
  generateR2Key,
  getPublicFileUrl,
  uploadFileToR2,
} from './r2';

describe('r2 service', () => {
  it('generates r2 key with user prefix and filename base', () => {
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const key = generateR2Key('u1', 'hello.txt');
    expect(key).toContain('u1/12345-');
    expect(key).toContain('-hello.txt');
  });

  it('uploads file to r2', async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    await uploadFileToR2(bucket as any, 'k1', new Uint8Array([1, 2]), 'text/plain');
    expect(bucket.put).toHaveBeenCalledWith('k1', expect.any(Uint8Array), {
      httpMetadata: { contentType: 'text/plain' },
    });
  });

  it('downloads file from r2', async () => {
    const object = { body: 'x' };
    const bucket = { get: vi.fn().mockResolvedValue(object) };
    await expect(downloadFileFromR2(bucket as any, 'k1')).resolves.toEqual(object);
  });

  it('deletes file from r2', async () => {
    const bucket = { delete: vi.fn().mockResolvedValue(undefined) };
    await deleteFileFromR2(bucket as any, 'k1');
    expect(bucket.delete).toHaveBeenCalledWith('k1');
  });

  it('checks file existence in r2', async () => {
    const bucket = { head: vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce(null) };
    await expect(fileExistsInR2(bucket as any, 'k1')).resolves.toBe(true);
    await expect(fileExistsInR2(bucket as any, 'k2')).resolves.toBe(false);
  });

  it('generates upload url', () => {
    const url = generatePresignedUploadUrl({} as any, 'a/b c.txt');
    expect(url).toBe('/api/upload-direct?key=a%2Fb%20c.txt');
  });

  it('generates public file url', () => {
    expect(getPublicFileUrl('f1', 'https://example.com')).toBe('https://example.com/f/f1');
  });
});
