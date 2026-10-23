import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';
import { withSerializedTransaction } from '../../database/serializedTransaction';

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

      const payload = pendingRows.map(row => {
        let createdAtNum = Date.now();
        if (typeof row.createdAt === 'number' && row.createdAt > 0) {
          createdAtNum = row.createdAt;
        } else if (typeof row.created_at === 'number' && row.created_at > 0) {
          createdAtNum = row.created_at;
        } else if (row.createdAt && typeof row.createdAt === 'string') {
          try { createdAtNum = new Date(row.createdAt).getTime(); } catch (_) {}
        } else if (row.created_at && typeof row.created_at === 'string') {
          try { createdAtNum = new Date(row.created_at).getTime(); } catch (_) {}
        }

        let updatedAtNum = Date.now();
        if (row.updated_at && typeof row.updated_at === 'number') {
          updatedAtNum = row.updated_at;
        } else if (typeof row.updatedAt === 'number' && row.updatedAt > 0) {
          updatedAtNum = row.updatedAt;
        } else if (row.updated_at && typeof row.updated_at === 'string') {
          try { updatedAtNum = new Date(row.updated_at).getTime(); } catch (_) {}
        }

        return {
          id: String(row.id),
          user_id: String(userId),
          title: String(row.title || 'Nueva Sesión'),
          created_at: createdAtNum,
          updated_at: new Date(updatedAtNum).toISOString(),
        };
      });

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

  /** Fase 1: Solo HTTP */
  async fetchRemote(userId: string, since: string | null): Promise<any[] | null> {
    try {
      let query = supabase.from('chat_sessions').select('*').eq('user_id', userId);
      if (since) {
        query = query.gt('updated_at', since);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching chat_sessions from Supabase:', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Exception in ChatSessionSyncAdapter.fetchRemote:', e);
      return null;
    }
  }

  /** Fase 2: Solo SQLite */
  async applyRemote(db: SQLiteDatabase, userId: string, since: string | null, remoteRows: any[]): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      if (!remoteRows) return result;

      await withSerializedTransaction(db, async () => {
        if (since === null && remoteRows.length > 0) {
          const remoteIds = new Set(remoteRows.map(r => String(r.id)));
          const localRows = await db.getAllAsync<{ id: string }>(
            `SELECT id FROM chat_sessions WHERE user_id = ? AND sync_status = 'SYNCED'`,
            [userId]
          );
          for (const localRow of localRows) {
            if (!remoteIds.has(String(localRow.id))) {
              await db.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [localRow.id]);
              await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [localRow.id]);
            }
          }
        }

        const pendingDelRows = await db.getAllAsync<{ recordId: string }>(
          `SELECT recordId FROM pending_deletions WHERE tableName = 'chat_sessions'`
        );
        const pendingDelIds = new Set(pendingDelRows.map(p => p.recordId));

        for (const r of remoteRows) {
          if (pendingDelIds.has(r.id)) continue;

          const createdAtVal = typeof r.created_at === 'number' ? r.created_at : (r.created_at ? new Date(r.created_at).getTime() : (r.createdAt || Date.now()));
          const updatedAtVal = r.updated_at ? new Date(r.updated_at).getTime() : (r.updatedAt || Date.now());

          await db.runAsync(
            `INSERT INTO chat_sessions (id, user_id, title, createdAt, updatedAt, updated_at, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, 'SYNCED')
             ON CONFLICT(id) DO UPDATE SET
               user_id = excluded.user_id,
               title = excluded.title,
               createdAt = excluded.createdAt,
               updatedAt = excluded.updatedAt,
               updated_at = excluded.updated_at,
               sync_status = 'SYNCED'
             WHERE excluded.updated_at >= chat_sessions.updated_at OR chat_sessions.updated_at IS NULL`,
            [
              r.id,
              r.user_id,
              r.title,
              createdAtVal,
              updatedAtVal,
              r.updated_at || new Date().toISOString(),
            ]
          );
          result.pulledCount++;
        }
      });
    } catch (e: any) {
      console.error('Exception in ChatSessionSyncAdapter.applyRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult> {
    const data = await this.fetchRemote(userId, since);
    if (data === null) return { success: false, pushedCount: 0, pulledCount: 0, errors: ['Fetch failed'] };
    return this.applyRemote(db, userId, since, data);
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
