import { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '../database/supabase';
import { withSerializedTransaction } from '../database/serializedTransaction';
import { SyncResult } from './SyncAdapter';

const TABLES = ['inventories', 'boxes', 'garments', 'garment_images', 'garment_alarms'];
const PAGE_SIZE = 500;
export const DELETION_CURSOR_PREFIX = 'deletion_tombstones_cursor:';

type Tombstone = { table_name: string; record_id: string; deleted_at: string };
let warnedMissingLog = false;

/** Solo se retiran IDs confirmados por DELETE o por el registro de borrados remoto. */
export async function applyConfirmedDeletions(
  db: SQLiteDatabase,
  rows: Array<{ table_name: string; record_id: string }>,
  cursor?: { key: string; value: string }
): Promise<number> {
  for (const row of rows) {
    if (!TABLES.includes(row.table_name) || typeof row.record_id !== 'string' || !row.record_id) {
      throw new Error('Identificador de eliminación remota inválido');
    }
  }
  let deletedCount = 0;
  await withSerializedTransaction(db, async () => {
    for (const row of rows) {
      // Las FK ON DELETE CASCADE retiran también cajas, prendas, fotos y alarmas.
      const deleted = await db.runAsync(`DELETE FROM ${row.table_name} WHERE id = ?`, [row.record_id]);
      deletedCount += deleted.changes;
    }
    if (cursor) {
      await db.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [cursor.key, cursor.value]
      );
    }
  });
  return deletedCount;
}

/** Aplica los borrados explícitos persistidos por Supabase. */
export async function syncRemoteDeletions(
  db: SQLiteDatabase,
  userId: string,
  forceFull = false
): Promise<SyncResult> {
  const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
  try {
    const cursorKey = `${DELETION_CURSOR_PREFIX}${userId}`;
    const saved = forceFull ? null : await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?', [cursorKey]
    );
    const tombstones: Tombstone[] = [];
    // Cursor independiente: last_sync_timestamp pudo avanzar sin leer los borrados.
    // Se conserva la fecha del servidor y se repite el límite para no perder empates.
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase.from('deletion_tombstones')
        .select('table_name, record_id, deleted_at')
        .in('table_name', TABLES);
      if (saved?.value) query = query.gte('deleted_at', saved.value);
      const { data, error } = await query
        .order('deleted_at', { ascending: true })
        .order('table_name', { ascending: true })
        .order('record_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error?.code === 'PGRST205' || error?.code === '42P01') {
        if (!warnedMissingLog) {
          console.warn('[SYNC_DELETE] Falta deletion_tombstones en Supabase. Los DELETE en vivo funcionan; instala la migración para recuperar borrados al reconectar.');
          warnedMissingLog = true;
        }
        return result;
      }
      if (error) throw new Error(`${error.code}: ${error.message}`);
      warnedMissingLog = false;
      const page = (data || []) as Tombstone[];
      for (const row of page) {
        if (!TABLES.includes(row.table_name) || !row.record_id || !Number.isFinite(Date.parse(row.deleted_at))) {
          throw new Error('Registro de eliminación inválido recibido de Supabase');
        }
      }
      tombstones.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    if (tombstones.length === 0) return result;
    result.pulledCount = await applyConfirmedDeletions(db, tombstones, {
      key: cursorKey,
      value: tombstones[tombstones.length - 1].deleted_at,
    });
    if (result.pulledCount > 0) {
      console.log(`[SYNC_DELETE] Aplicados ${result.pulledCount} borrados remotos en SQLite.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[SYNC_DELETE] No se pudieron aplicar los borrados remotos:', message);
    return { success: false, pushedCount: 0, pulledCount: 0, errors: [message] };
  }
  return result;
}
