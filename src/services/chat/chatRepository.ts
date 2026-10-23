import { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '../../database/supabase';
import { SearchResult } from '../../utils/nlpEngine';
import { ChatSession } from '../../types';
import { generateUUID } from '../../utils/uuid';

export interface BoxMatchData {
  id: string;
  name: string;
  inventory_name: string;
  inventory_id: string;
  total_garments: number;
  active_count: number;
  inactive_count: number;
}

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  matches?: SearchResult[];
  boxMatch?: BoxMatchData;
  engineUsed?: 'ia' | 'local';
  modelName?: string;
  timestamp: number;
}

export const ChatRepository = {
  getSessions: async (db: SQLiteDatabase, userId?: string | null): Promise<ChatSession[]> => {
    try {
      if (userId) {
        return await db.getAllAsync<ChatSession>(
          'SELECT * FROM chat_sessions WHERE user_id = ? AND (deleted_at IS NULL OR deleted_at = "") ORDER BY updatedAt DESC',
          [userId]
        );
      } else {
        return await db.getAllAsync<ChatSession>(
          'SELECT * FROM chat_sessions WHERE (user_id IS NULL OR user_id = "") AND (deleted_at IS NULL OR deleted_at = "") ORDER BY updatedAt DESC'
        );
      }
    } catch (e) {
      console.error('Error fetching chat sessions', e);
      return [];
    }
  },

  /** Adopta sesiones huérfanas (sin user_id) asignándoles el userId actual. Llamar una vez al iniciar. */
  adoptOrphanSessions: async (db: SQLiteDatabase, userId: string): Promise<void> => {
    try {
      await db.runAsync(
        `UPDATE chat_sessions SET user_id = ?, sync_status = 'PENDING' WHERE (user_id IS NULL OR user_id = '') AND (deleted_at IS NULL OR deleted_at = '')`,
        [userId]
      );
    } catch (e) {
      console.warn('Error adoptando sesiones huérfanas:', e);
    }
  },

  /** Limpia sesiones con soft-delete residual. Llamar una vez al iniciar, NO en cada lectura. */
  cleanupSoftDeleted: async (db: SQLiteDatabase): Promise<void> => {
    try {
      await db.runAsync('DELETE FROM chat_history WHERE sessionId IN (SELECT id FROM chat_sessions WHERE deleted_at IS NOT NULL)');
      await db.runAsync('DELETE FROM chat_sessions WHERE deleted_at IS NOT NULL');
    } catch (e) {
      console.warn('Error limpiando sesiones eliminadas:', e);
    }
  },

  createSession: async (db: SQLiteDatabase, title: string = 'Nueva conversación', userId?: string | null): Promise<string> => {
    const id = Date.now().toString();
    const now = Date.now();
    const nowIso = new Date().toISOString();
    try {
      await db.runAsync(
        'INSERT INTO chat_sessions (id, title, createdAt, updatedAt, updated_at, sync_status, user_id) VALUES (?, ?, ?, ?, ?, "PENDING", ?)',
        [id, title, now, now, nowIso, userId || null]
      );
    } catch (e) {
      console.error('Error creating chat session', e);
    }
    return id;
  },

  updateSessionTitle: async (db: SQLiteDatabase, sessionId: string, newTitle: string): Promise<void> => {
    try {
      const now = Date.now();
      const nowIso = new Date().toISOString();
      await db.runAsync(
        'UPDATE chat_sessions SET title = ?, updatedAt = ?, updated_at = ?, sync_status = "PENDING" WHERE id = ?',
        [newTitle, now, nowIso, sessionId]
      );
    } catch (e) {
      console.error('Error updating chat session title', e);
    }
  },

  deleteSession: async (db: SQLiteDatabase, sessionId: string, userId?: string | null): Promise<void> => {
    try {
      const nowIso = new Date().toISOString();

      // 1. Eliminar mensajes y la sesión de SQLite localmente
      await db.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [sessionId]);
      await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);

      // 2. Registrar en la cola de eliminaciones pendientes para sincronización resiliente
      const delId = generateUUID();
      await db.runAsync(
        'INSERT OR REPLACE INTO pending_deletions (id, tableName, recordId, createdAt) VALUES (?, "chat_sessions", ?, ?)',
        [delId, sessionId, nowIso]
      );

      // 3. Si el usuario está autenticado, borrar de Supabase (primero mensajes, luego sesión)
      if (userId) {
        try {
          await supabase
            .from('chat_messages')
            .delete()
            .eq('session_id', sessionId);

          const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);

          if (!error) {
            // Si ya se borró con éxito de la nube, eliminar de la cola de pendientes
            await db.runAsync(
              'DELETE FROM pending_deletions WHERE recordId = ? AND tableName = "chat_sessions"',
              [sessionId]
            ).catch(() => {});
          }
        } catch (cloudErr) {
          console.warn('Advertencia al eliminar sesión en la nube (se reintentará en sync):', cloudErr);
        }
      }
    } catch (e) {
      console.error('Error deleting chat session', e);
    }
  },

  getHistoryBySession: async (db: SQLiteDatabase, sessionId: string): Promise<ChatMessage[]> => {
    try {
      const rows = await db.getAllAsync<{
        id: string;
        sender: 'bot' | 'user';
        text: string;
        timestamp: any;
        matches_json?: string;
        engineUsed?: 'ia' | 'local';
      }>(
        'SELECT * FROM chat_history WHERE sessionId = ? ORDER BY timestamp DESC',
        [sessionId]
      );

      return rows.map(r => {
        let matches: SearchResult[] | undefined;
        let boxMatch: BoxMatchData | undefined;

        if (r.matches_json) {
          try {
            const parsed = JSON.parse(r.matches_json);
            if (Array.isArray(parsed)) {
              matches = parsed;
            } else if (parsed && typeof parsed === 'object') {
              matches = parsed.matches || undefined;
              boxMatch = parsed.boxMatch || parsed.cajaMatch || undefined;
            }
          } catch (_) {}
        }

        const numTs = typeof r.timestamp === 'number'
          ? r.timestamp
          : (Number(r.timestamp) && !isNaN(Number(r.timestamp))
              ? Number(r.timestamp)
              : new Date(r.timestamp || Date.now()).getTime());

        return {
          id: r.id,
          sender: r.sender,
          text: r.text,
          matches,
          boxMatch,
          engineUsed: r.engineUsed,
          timestamp: numTs,
        };
      });
    } catch (e) {
      console.error('Error fetching chat history by session', e);
      return [];
    }
  },

  saveMessage: async (db: SQLiteDatabase, message: ChatMessage, sessionId: string): Promise<void> => {
    try {
      const matchesPayload = (message.matches && message.matches.length > 0) || message.boxMatch
        ? JSON.stringify({ matches: message.matches || [], boxMatch: message.boxMatch })
        : null;

      const nowIso = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO chat_history (id, sessionId, sender, text, timestamp, matches_json, engineUsed, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "PENDING")',
        [
          message.id,
          sessionId,
          message.sender,
          message.text,
          message.timestamp,
          matchesPayload,
          message.engineUsed || null,
          nowIso,
        ]
      );

      const now = Date.now();
      await db.runAsync(
        'UPDATE chat_sessions SET updatedAt = ?, updated_at = ?, sync_status = "PENDING" WHERE id = ?',
        [now, nowIso, sessionId]
      );
    } catch (e) {
      console.error('Error saving chat message', e);
    }
  },

  clearHistory: async (db: SQLiteDatabase, userId?: string | null): Promise<void> => {
    try {
      if (userId) {
        await supabase.from('chat_messages').delete().neq('id', '');
        await supabase.from('chat_sessions').delete().neq('id', '');
      }
      await db.runAsync('DELETE FROM chat_history');
      await db.runAsync('DELETE FROM chat_sessions');
    } catch (e) {
      console.error('Error clearing history', e);
    }
  }
};
