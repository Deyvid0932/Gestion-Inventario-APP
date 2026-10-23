import { SQLiteDatabase } from 'expo-sqlite';
import { withSerializedTransaction } from '../database/serializedTransaction';

type SyncRow = { id: string; updated_at?: string | null };
type SyncTable = 'inventories' | 'boxes' | 'garments';

// Reclamar únicamente la versión que se leyó. Una edición posterior debe seguir PENDING.
export async function claimPendingRows<T extends SyncRow>(
  db: SQLiteDatabase,
  table: SyncTable,
  rows: T[],
  userId?: string
): Promise<T[]> {
  const claimed: T[] = [];
  if (rows.length === 0) return claimed;
  await withSerializedTransaction(db, async () => {
    for (const row of rows) {
      const result = table === 'inventories' && userId
        ? await db.runAsync(
          `UPDATE inventories SET sync_status = 'SYNCING', user_id = COALESCE(NULLIF(user_id, ''), ?)
           WHERE id = ? AND updated_at IS ? AND sync_status IN ('PENDING', 'FAILED')`,
          [userId, row.id, row.updated_at ?? null]
        )
        : await db.runAsync(
          `UPDATE ${table} SET sync_status = 'SYNCING'
           WHERE id = ? AND updated_at IS ? AND sync_status IN ('PENDING', 'FAILED')`,
          [row.id, row.updated_at ?? null]
        );
      if (result.changes > 0) claimed.push(row);
    }
  });
  return claimed;
}

export async function finishClaimedRows(
  db: SQLiteDatabase,
  table: SyncTable,
  rows: SyncRow[],
  status: 'SYNCED' | 'FAILED'
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `UPDATE ${table} SET sync_status = ?
       WHERE id = ? AND updated_at IS ? AND sync_status = 'SYNCING'`,
      [status, row.id, row.updated_at ?? null]
    );
  }
}
