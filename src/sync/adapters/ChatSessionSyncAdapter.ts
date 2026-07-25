import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';

export class ChatSessionSyncAdapter implements SyncAdapter {
  tableName = 'chat_sessions';

  async pushLocal(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<any>(
        `SELECT * FROM chat_sessions WHERE (sync_status = 'PENDING' OR sync_status = 'FAILED') AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
        [userId]
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const ids = pendingRows.map(r => r.id);
      for (const id of ids) {
        await db.runAsync(`UPDATE chat_sessions SET sync_status = 'SYNCING', user_id = ? WHERE id = ?`, [userId, id]);
      }

      const payload = pendingRows.map(row => ({
        id: row.id,
        user_id: userId,
        title: row.title,
        "createdAt": row.createdAt,
        "updatedAt": row.updatedAt,
        updated_at: row.updated_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('chat_sessions').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error al hacer push de chat_sessions a Supabase:', error);
        for (const id of ids) {
          await db.runAsync(`UPDATE chat_sessions SET sync_status = 'FAILED' WHERE id = ?`, [id]);
        }
        result.success = false;
        result.errors = [error.message];
      } else {
        for (const id of ids) {
          await db.runAsync(`UPDATE chat_sessions SET sync_status = 'SYNCED' WHERE id = ?`, [id]);
        }
        result.pushedCount = pendingRows.length;
      }
    } catch (e: any) {
      console.error('Excepción en ChatSessionSyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      let query = supabase.from('chat_sessions').select('*').eq('user_id', userId);
      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        console.error('Error al hacer pull de chat_sessions desde Supabase:', error);
        result.success = false;
        result.errors = [error.message];
        return result;
      }

      if (!remoteRows) {
        return result;
      }

      await db.withTransactionAsync(async () => {
        if (since === null) {
          const remoteIds = new Set(remoteRows.map(r => r.id));
          const localRows = await db.getAllAsync<{ id: string }>('SELECT id FROM chat_sessions WHERE user_id = ?', [userId]);
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [localRow.id]);
              await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const local = await db.getFirstAsync<any>('SELECT * FROM chat_sessions WHERE id = ?', [r.id]);

          if (!local) {
            await db.runAsync(
              `INSERT INTO chat_sessions (id, user_id, title, createdAt, updatedAt, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                r.user_id,
                r.title,
                r.createdAt,
                r.updatedAt,
                r.updated_at,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

            if (remoteTime >= localTime) {
              await db.runAsync(
                `UPDATE chat_sessions SET user_id = ?, title = ?, createdAt = ?, updatedAt = ?, updated_at = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  r.user_id,
                  r.title,
                  r.createdAt,
                  r.updatedAt,
                  r.updated_at,
                  r.id,
                ]
              );
              result.pulledCount++;
            }
          }
        }
      });
    } catch (e: any) {
      console.error('Excepción en ChatSessionSyncAdapter.pullRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM chat_sessions');
    } catch (e) {
      console.error('Error al limpiar chat_sessions locales:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE chat_sessions SET user_id = ?, sync_status = 'PENDING', updated_at = ? WHERE user_id IS NULL OR user_id = ''`,
        [userId, now]
      );
    } catch (e) {
      console.error('Error al adoptar chat_sessions para el usuario:', e);
    }
  }
}
