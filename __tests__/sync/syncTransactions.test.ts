import type { SQLiteDatabase } from 'expo-sqlite';
import { withSerializedTransaction } from '../../src/database/serializedTransaction';
import { claimPendingRows, finishClaimedRows } from '../../src/sync/claimedRows';

describe('transacciones de sincronización', () => {
  it('no abre dos transacciones simultáneas en la misma conexión', async () => {
    let active = false;
    const order: number[] = [];
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        if (active) throw new Error('cannot start a transaction within a transaction');
        active = true;
        try { await task(); } finally { active = false; }
      },
    } as unknown as SQLiteDatabase;

    await Promise.all([1, 2, 3].map(index => withSerializedTransaction(db, async () => {
      await Promise.resolve();
      order.push(index);
    })));

    expect(order).toEqual([1, 2, 3]);
  });

  it('no marca SYNCED una fila editada mientras se subía', async () => {
    const row = { id: 'inv-1', updated_at: 'antes', sync_status: 'PENDING' };
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => task(),
      runAsync: async (query: string, params: unknown[]) => {
        const expectedVersion = params[params.length - 1];
        if (row.updated_at !== expectedVersion) return { changes: 0 };
        if (query.includes("sync_status IN ('PENDING', 'FAILED')")) {
          if (row.sync_status !== 'PENDING') return { changes: 0 };
          row.sync_status = 'SYNCING';
        } else if (row.sync_status === 'SYNCING') {
          row.sync_status = params[0] as string;
        }
        return { changes: 1 };
      },
    } as unknown as SQLiteDatabase;

    const claimed = await claimPendingRows(db, 'inventories', [{ ...row }]);
    expect(claimed).toHaveLength(1);
    row.updated_at = 'después';
    row.sync_status = 'PENDING';
    await finishClaimedRows(db, 'inventories', claimed, 'SYNCED');
    expect(row.sync_status).toBe('PENDING');
  });
});
