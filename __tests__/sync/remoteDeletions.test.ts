import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '../../src/database/supabase';
import { applyConfirmedDeletions, DELETION_CURSOR_PREFIX, syncRemoteDeletions } from '../../src/sync/deletionTombstones';
import { InventorySyncAdapter } from '../../src/sync/adapters/InventorySyncAdapter';

jest.mock('../../src/database/supabase', () => ({ supabase: { from: jest.fn() } }));
const { DatabaseSync } = require('node:sqlite');
const mockFrom = supabase.from as jest.Mock;
const deletedAt = '2026-09-20T12:00:00.000Z';
let sqlite: any;
let db: SQLiteDatabase;

function remoteDeletions(rows: any[], error: any = null) {
  const query: any = {};
  for (const method of ['select', 'in', 'gte', 'order']) query[method] = jest.fn(() => query);
  query.range = jest.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error }));
  mockFrom.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE inventories (
      id TEXT PRIMARY KEY, user_id TEXT, name TEXT, description TEXT, status INTEGER,
      order_index INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT,
      deleted_by TEXT, deletion_batch_id TEXT, sync_status TEXT
    );
    CREATE TABLE boxes (id TEXT PRIMARY KEY, inventory_id TEXT REFERENCES inventories(id) ON DELETE CASCADE);
    CREATE TABLE garments (id TEXT PRIMARY KEY, box_id TEXT REFERENCES boxes(id) ON DELETE CASCADE);
    CREATE TABLE garment_images (id TEXT PRIMARY KEY, garment_id TEXT REFERENCES garments(id) ON DELETE CASCADE);
    CREATE TABLE garment_alarms (id TEXT PRIMARY KEY, garment_id TEXT REFERENCES garments(id) ON DELETE CASCADE);
    INSERT INTO inventories (id, user_id, name, sync_status) VALUES ('deleted', 'owner', 'Lote', 'SYNCED'), ('keep', 'owner', 'Otro', 'SYNCED');
    INSERT INTO boxes VALUES ('box', 'deleted');
    INSERT INTO garments VALUES ('garment', 'box');
    INSERT INTO garment_images VALUES ('image', 'garment');
    INSERT INTO garment_alarms VALUES ('alarm', 'garment');
  `);
  db = {
    getFirstAsync: async (sql: string, params: any[] = []) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params),
    runAsync: async (sql: string, params: any[] = []) => sqlite.prepare(sql).run(...params),
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as SQLiteDatabase;
});

afterEach(() => sqlite.close());

it('recupera un borrado antiguo y retira solo ese inventario con todos sus hijos', async () => {
  const query = remoteDeletions([{ table_name: 'inventories', record_id: 'deleted', deleted_at: deletedAt }]);
  const result = await syncRemoteDeletions(db, 'current-user');
  expect(result.success).toBe(true);
  expect(query.gte).not.toHaveBeenCalled();
  expect(sqlite.prepare('SELECT id FROM inventories').all()).toEqual([{ id: 'keep' }]);
  for (const table of ['boxes', 'garments', 'garment_images', 'garment_alarms']) {
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n).toBe(0);
  }
  expect(sqlite.prepare('SELECT value FROM app_settings WHERE key = ?').get(`${DELETION_CURSOR_PREFIX}current-user`).value).toBe(deletedAt);
});

it('no borra datos locales cuando la consulta de eliminaciones viene vacía', async () => {
  remoteDeletions([]);
  expect((await syncRemoteDeletions(db, 'current-user')).success).toBe(true);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM inventories').get().n).toBe(2);
});

it('aplica el ID de un DELETE en vivo sin depender de la tabla de borrados', async () => {
  expect(await applyConfirmedDeletions(db, [{ table_name: 'boxes', record_id: 'box' }])).toBe(1);
  expect(mockFrom).not.toHaveBeenCalled();
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM inventories').get().n).toBe(2);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM garments').get().n).toBe(0);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM garment_alarms').get().n).toBe(0);
});

it('no interrumpe la sincronización general cuando aún no se instaló el registro remoto', async () => {
  remoteDeletions([], { code: 'PGRST205', message: 'table not found' });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect((await syncRemoteDeletions(db, 'current-user')).success).toBe(true);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM inventories').get().n).toBe(2);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM app_settings').get().n).toBe(0);
  warn.mockRestore();
});

it('mantiene datos y cursor cuando Supabase rechaza la consulta', async () => {
  remoteDeletions([], { code: '42501', message: 'permission denied' });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await syncRemoteDeletions(db, 'current-user');
  expect(result.success).toBe(false);
  expect(result.errors?.[0]).toContain('42501');
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM inventories').get().n).toBe(2);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM app_settings').get().n).toBe(0);
  warn.mockRestore();
});

it('revierte toda la operación si SQLite falla antes de guardar el cursor', async () => {
  remoteDeletions([{ table_name: 'inventories', record_id: 'deleted', deleted_at: deletedAt }]);
  sqlite.exec("CREATE TRIGGER fail_cursor BEFORE INSERT ON app_settings BEGIN SELECT RAISE(ABORT, 'disk error'); END;");
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect((await syncRemoteDeletions(db, 'current-user')).success).toBe(false);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM inventories').get().n).toBe(2);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM garment_images').get().n).toBe(1);
  warn.mockRestore();
});

it('pagina los borrados y repite la fecha límite del servidor', async () => {
  sqlite.prepare('INSERT INTO app_settings VALUES (?, ?)').run(`${DELETION_CURSOR_PREFIX}current-user`, deletedAt);
  const rows = Array.from({ length: 501 }, (_, i) => ({ table_name: 'garments', record_id: `missing-${i}`, deleted_at: deletedAt }));
  const query = remoteDeletions(rows);
  expect((await syncRemoteDeletions(db, 'current-user')).success).toBe(true);
  expect(query.range).toHaveBeenCalledTimes(2);
  expect(query.gte).toHaveBeenCalledWith('deleted_at', deletedAt);
});

it('sube el borrado de un lote compartido conservando la cuenta que lo creó', async () => {
  sqlite.prepare("UPDATE inventories SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = 'deleted'").run(deletedAt, deletedAt);
  const upsert = jest.fn(async () => ({ error: null }));
  mockFrom.mockReturnValue({ upsert });
  const result = await new InventorySyncAdapter().pushLocal(db, 'editor');
  expect(result.success).toBe(true);
  expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ id: 'deleted', user_id: 'owner', deleted_at: deletedAt, status: 0 })], { onConflict: 'id' });
  expect(sqlite.prepare("SELECT user_id, sync_status FROM inventories WHERE id = 'deleted'").get()).toEqual({ user_id: 'owner', sync_status: 'SYNCED' });
});
