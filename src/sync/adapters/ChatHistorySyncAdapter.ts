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
        let isoCreatedAt = new Date().toISOString();
        if (typeof row.timestamp === 'number' && row.timestamp > 0) {
          isoCreatedAt = new Date(row.timestamp).toISOString();
        } else if (typeof row.created_at === 'number' && row.created_at > 0) {
          isoCreatedAt = new Date(row.created_at).toISOString();
        } else if (row.timestamp && typeof row.timestamp === 'string') {
          try { isoCreatedAt = new Date(row.timestamp).toISOString(); } catch (_) {}
        } else if (row.created_at && typeof row.created_at === 'string') {
          try { isoCreatedAt = new Date(row.created_at).toISOString(); } catch (_) {}
        }

        let isoUpdatedAt = new Date().toISOString();
        if (row.updated_at && typeof row.updated_at === 'string') {
          try { isoUpdatedAt = new Date(row.updated_at).toISOString(); } catch (_) {}
        } else if (typeof row.updatedAt === 'number' && row.updatedAt > 0) {
          isoUpdatedAt = new Date(row.updatedAt).toISOString();
        }

        const tsNumber = typeof row.timestamp === 'number' && row.timestamp > 0 
          ? row.timestamp 
          : (row.created_at && typeof row.created_at === 'number' ? row.created_at : new Date(isoCreatedAt).getTime());

        return {
          id: String(row.id),
          session_id: String(row.session_id ?? row.sessionId),
          sender: String(row.sender || 'user'),
          content: String(row.content ?? row.text ?? ''),
          matches_json: parsedMatches,
          engine_used: row.engine_used ?? row.engineUsed ?? null,
          created_at: tsNumber,
          updated_at: isoUpdatedAt,
        };
      });

      const { error } = await supabase.from('chat_messages').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error al hacer push de chat_messages a Supabase:', error);
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
      let query = supabase.from('chat_messages').select('*');
      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        console.error('Error al hacer pull de chat_messages desde Supabase:', error);
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
          const sessionIdVal = r.session_id || r.sessionId;
          const textVal = r.content || r.text || '';
          const engineVal = r.engine_used || r.engineUsed || null;
          const timestampVal = r.timestamp || r.created_at || new Date().toISOString();

          // Garantizar integridad referencial de Foreign Key (sessionId -> chat_sessions.id)
          if (sessionIdVal) {
            const parentSession = await db.getFirstAsync('SELECT id FROM chat_sessions WHERE id = ?', [sessionIdVal]);
            if (!parentSession) {
              const numericTimestamp = new Date(timestampVal).getTime();
              await db.runAsync(
                `INSERT OR IGNORE INTO chat_sessions (id, user_id, title, createdAt, updatedAt, updated_at, sync_status) 
                 VALUES (?, ?, 'Chat Sincronizado', ?, ?, ?, 'SYNCED')`,
                [sessionIdVal, _userId || '', numericTimestamp, numericTimestamp, r.updated_at || new Date().toISOString()]
              );
            }
          } else {
            // Si el registro de Supabase carece de session_id, omitirlo para no violar la Foreign Key
            continue;
          }

          if (!local) {
            await db.runAsync(
              `INSERT INTO chat_history (id, sessionId, sender, text, matches_json, engineUsed, timestamp, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                sessionIdVal,
                r.sender,
                textVal,
                matchesStr,
                engineVal,
                timestampVal,
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
                  sessionIdVal,
                  r.sender,
                  textVal,
                  matchesStr,
                  engineVal,
                  timestampVal,
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
