import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupExpiredFiles,
  createFileRecord,
  deleteFileRecord,
  getFileById,
  getUserFiles,
  incrementDownloadCount,
  isFileExpired,
} from './file';

describe('file service', () => {
  let db: any;
  let stmt: any;

  beforeEach(() => {
    stmt = {
      bind: vi.fn(),
      run: vi.fn(),
      first: vi.fn(),
      all: vi.fn(),
    };
    stmt.bind.mockReturnValue(stmt);
    db = {
      prepare: vi.fn().mockReturnValue(stmt),
    };
  });

  it('creates file record', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('file-1');
    stmt.run.mockResolvedValue({ success: true });

    const id = await createFileRecord(db, {
      userId: 'u1',
      filename: 'a.txt',
      contentType: 'text/plain',
      size: 10,
      expiresAt: new Date('2026-02-20T00:00:00.000Z'),
      r2Key: 'u1/abc-a.txt',
    });

    expect(id).toBe('file-1');
    expect(db.prepare).toHaveBeenCalledOnce();
    expect(stmt.bind).toHaveBeenCalledWith(
      'file-1',
      'u1',
      'a.txt',
      'text/plain',
      10,
      'u1/abc-a.txt',
      '2026-02-20T00:00:00.000Z'
    );
  });

  it('throws when create record fails', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('file-1');
    stmt.run.mockResolvedValue({ success: false });

    await expect(
      createFileRecord(db, {
        userId: 'u1',
        filename: 'a.txt',
        contentType: 'text/plain',
        size: 10,
        expiresAt: new Date(),
        r2Key: 'u1/abc-a.txt',
      })
    ).rejects.toThrow('Failed to create file record');
  });

  it('gets file by id', async () => {
    stmt.first.mockResolvedValue({ id: 'f1' });
    const file = await getFileById(db, 'f1');

    expect(file).toEqual({ id: 'f1' });
    expect(stmt.bind).toHaveBeenCalledWith('f1');
  });

  it('gets user files and falls back to empty list', async () => {
    stmt.all.mockResolvedValueOnce({ results: [{ id: 'f1' }] });
    expect(await getUserFiles(db, 'u1')).toEqual([{ id: 'f1' }]);

    stmt.all.mockResolvedValueOnce({});
    expect(await getUserFiles(db, 'u1')).toEqual([]);
  });

  it('deletes file record and checks change count', async () => {
    stmt.run.mockResolvedValueOnce({ success: true, meta: { changes: 1 } });
    expect(await deleteFileRecord(db, 'f1', 'u1')).toBe(true);

    stmt.run.mockResolvedValueOnce({ success: true, meta: { changes: 0 } });
    expect(await deleteFileRecord(db, 'f1', 'u1')).toBe(false);
  });

  it('increments download count', async () => {
    stmt.run.mockResolvedValue({ success: true });
    await incrementDownloadCount(db, 'f1');
    expect(stmt.bind).toHaveBeenCalledWith('f1');
    expect(stmt.run).toHaveBeenCalledOnce();
  });

  it('returns true when file is missing or expired', async () => {
    stmt.first.mockResolvedValueOnce(null);
    expect(await isFileExpired(db, 'f1')).toBe(true);

    stmt.first.mockResolvedValueOnce({ expires_at: '2020-01-01T00:00:00.000Z' });
    expect(await isFileExpired(db, 'f1')).toBe(true);
  });

  it('returns false when file is not expired', async () => {
    stmt.first.mockResolvedValue({ expires_at: '2999-01-01T00:00:00.000Z' });
    expect(await isFileExpired(db, 'f1')).toBe(false);
  });

  it('cleans up expired files and skips failed deletions', async () => {
    const selectStmt = {
      bind: vi.fn(),
      all: vi.fn().mockResolvedValue({
        results: [
          { id: 'f1', r2_key: 'k1' },
          { id: 'f2', r2_key: 'k2' },
        ],
      }),
      run: vi.fn(),
      first: vi.fn(),
    };
    selectStmt.bind.mockReturnValue(selectStmt);

    const deleteStmt = {
      bind: vi.fn(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn(),
    };
    deleteStmt.bind.mockReturnValue(deleteStmt);

    db.prepare = vi
      .fn()
      .mockImplementation((sql: string) => (sql.startsWith('SELECT') ? selectStmt : deleteStmt));

    const r2 = {
      delete: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('r2 failed')),
    };

    const result = await cleanupExpiredFiles(db, r2 as any);

    expect(result).toBe(1);
    expect(r2.delete).toHaveBeenCalledTimes(2);
    expect(deleteStmt.run).toHaveBeenCalledTimes(1);
  });
});
