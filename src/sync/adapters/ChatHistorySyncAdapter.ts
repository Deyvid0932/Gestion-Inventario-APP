import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';

export class ChatHistorySyncAdapter implements SyncAdapter {
  tableName = 'chat_history';

  async pushLocal(db: SQLiteDatabase, _userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<any>(
        `SELECT * FROM chat_history WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const ids = pendingRows.map(r => r.id);
      for (const id of ids) {
        await db.runAsync(`UPDATE chat_history SET sync_status = 'SYNCING' WHERE id = ?`, [id]);
      }

      const payload = pendingRows.map(row => {
        let parsedMatches = null;
        if (row.matches_json) {
          try {
            parsedMatches = typeof row.matches_json === 'string' ? JSON.parse(row.matches_json) : row.matches_json;
          } catch (e) {
            parsedMatches = null;
          }
        }
        return {
          id: row.id,
          "sessionId": row.sessionId,
          sender: row.sender,
          text: row.text,
          matches_json: parsedMatches,
          "engineUsed": row.engineUsed || null,
          timestamp: row.timestamp,
          updated_at: row.updated_at || new Date().toISOString(),
        };
      });

      const { error } = await supabase.from('chat_history').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error al hacer push de chat_history a Supabase:', error);
        for (const id of ids) {
          await db.runAsync(`UPDATE chat_history SET sync_status = 'FAILED' WHERE id = ?`, [id]);
        }
        result.success = false;
        result.errors = [error.message];
      } else {
        for (const id of ids) {
          await db.runAsync(`UPDATE chat_history SET sync_status = 'SYNCED' WHERE id = ?`, [id]);
        }
        result.pushedCount = pendingRows.length;
      }
    } catch (e: any) {
      console.error('Excepción en ChatHistorySyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, _userId: string, since: string | null): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      let query = supabase.from('chat_history').select('*');
      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        console.error('Error al hacer pull de chat_history desde Supabase:', error);
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
          const localRows = await db.getAllAsync<{ id: string }>('SELECT id FROM chat_history');
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM chat_history WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const local = await db.getFirstAsync<any>('SELECT * FROM chat_history WHERE id = ?', [r.id]);
          const matchesStr = r.matches_json ? (typeof r.matches_json === 'string' ? r.matches_json : JSON.stringify(r.matches_json)) : null;

          if (!local) {
            await db.runAsync(
              `INSERT INTO chat_history (id, sessionId, sender, text, matches_json, engineUsed, timestamp, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                r.sessionId,
                r.sender,
                r.text,
                matchesStr,
                r.engineUsed || null,
                r.timestamp,
                r.updated_at,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

            if (remoteTime >= localTime) {
              await db.runAsync(
                `UPDATE chat_history SET sessionId = ?, sender = ?, text = ?, matches_json = ?, engineUsed = ?, timestamp = ?, updated_at = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  r.sessionId,
                  r.sender,
                  r.text,
                  matchesStr,
                  r.engineUsed || null,
                  r.timestamp,
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
      console.error('Excepción en ChatHistorySyncAdapter.pullRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM chat_history');
    } catch (e) {
      console.error('Error al limpiar chat_history locales:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, _userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(`UPDATE chat_history SET sync_status = 'PENDING', updated_at = ? WHERE sync_status IS NULL OR sync_status = ''`, [now]);
    } catch (e) {
      console.error('Error al adoptar chat_history:', e);
    }
  }
}
