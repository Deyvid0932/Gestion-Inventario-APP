import { SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from '../utils/uuid';

export const DATABASE_VERSION = 4;

const CANONICAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  INSERT OR IGNORE INTO app_settings (key, value) VALUES ('themeMode', 'light');
  INSERT OR IGNORE INTO app_settings (key, value) VALUES ('colorScheme', 'morado');

  -- Inventories
  CREATE TABLE IF NOT EXISTS inventories (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    order_index INTEGER DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT,
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'PENDING',
    deleted_by TEXT,
    deletion_batch_id TEXT
  );

  -- Boxes
  CREATE TABLE IF NOT EXISTS boxes (
    id TEXT PRIMARY KEY NOT NULL,
    inventory_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    order_index INTEGER DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT,
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'PENDING',
    deleted_by TEXT,
    deletion_batch_id TEXT,
    FOREIGN KEY (inventory_id) REFERENCES inventories (id) ON DELETE CASCADE
  );

  -- Garments
  CREATE TABLE IF NOT EXISTS garments (
    id TEXT PRIMARY KEY NOT NULL,
    box_id TEXT NOT NULL,
    op TEXT,
    style TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT,
    shipping_at TEXT,
    status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'PENDING',
    deleted_by TEXT,
    deletion_batch_id TEXT,
    FOREIGN KEY (box_id) REFERENCES boxes (id) ON DELETE CASCADE
  );

  -- Garment Images
  CREATE TABLE IF NOT EXISTS garment_images (
    id TEXT PRIMARY KEY NOT NULL,
    garment_id TEXT NOT NULL,
    uri TEXT,
    storage_key TEXT,
    storage TEXT NOT NULL DEFAULT 'LOCAL',
    order_index INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    deleted_by TEXT,
    deletion_batch_id TEXT,
    sync_status TEXT DEFAULT 'PENDING',
    FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE
  );

  -- Garment Alarms
  CREATE TABLE IF NOT EXISTS garment_alarms (
    id TEXT PRIMARY KEY NOT NULL,
    garment_id TEXT NOT NULL,
    alarm_datetime TEXT NOT NULL,
    expires_at TEXT,
    notification_id TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    deleted_by TEXT,
    deletion_batch_id TEXT,
    sync_status TEXT DEFAULT 'PENDING',
    FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE
  );

  -- Chat Sessions
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'PENDING'
  );

  -- Chat History
  CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY NOT NULL,
    sessionId TEXT,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    matches_json TEXT,
    engineUsed TEXT,
    timestamp INTEGER NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'PENDING',
    FOREIGN KEY (sessionId) REFERENCES chat_sessions (id) ON DELETE CASCADE
  );

  -- Deletion Queue
  CREATE TABLE IF NOT EXISTS pending_deletions (
    id TEXT PRIMARY KEY NOT NULL,
    tableName TEXT NOT NULL,
    recordId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  -- Respaldo local de emergencia para cambios que todavía no llegaron a Supabase.
  CREATE TABLE IF NOT EXISTS sync_safety_snapshots (
    user_id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- High performance indexes
  CREATE INDEX IF NOT EXISTS idx_inventories_user ON inventories(user_id);
  CREATE INDEX IF NOT EXISTS idx_inventories_del ON inventories(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_inventories_sync ON inventories(sync_status);

  CREATE INDEX IF NOT EXISTS idx_boxes_inventory ON boxes(inventory_id);
  CREATE INDEX IF NOT EXISTS idx_boxes_del ON boxes(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_boxes_sync ON boxes(sync_status);

  CREATE INDEX IF NOT EXISTS idx_garments_box ON garments(box_id);
  CREATE INDEX IF NOT EXISTS idx_garments_op ON garments(box_id, op);
  CREATE INDEX IF NOT EXISTS idx_garments_status ON garments(status);
  CREATE INDEX IF NOT EXISTS idx_garments_created ON garments(created_at);
  CREATE INDEX IF NOT EXISTS idx_garments_del ON garments(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_garments_sync ON garments(sync_status);
  CREATE INDEX IF NOT EXISTS idx_garments_style ON garments(style);
  CREATE INDEX IF NOT EXISTS idx_garments_color ON garments(color);

  CREATE INDEX IF NOT EXISTS idx_garment_images_garment ON garment_images(garment_id);
  CREATE INDEX IF NOT EXISTS idx_garment_images_primary ON garment_images(garment_id) WHERE is_primary = 1;
  CREATE INDEX IF NOT EXISTS idx_garment_images_storage ON garment_images(storage);
  CREATE INDEX IF NOT EXISTS idx_garment_images_batch ON garment_images(deletion_batch_id);
  CREATE INDEX IF NOT EXISTS idx_garment_images_sync ON garment_images(sync_status);

  CREATE INDEX IF NOT EXISTS idx_garment_alarms_garment ON garment_alarms(garment_id);
  CREATE INDEX IF NOT EXISTS idx_garment_alarms_expires ON garment_alarms(expires_at);
  CREATE INDEX IF NOT EXISTS idx_garment_alarms_batch ON garment_alarms(deletion_batch_id);
  CREATE INDEX IF NOT EXISTS idx_garment_alarms_sync ON garment_alarms(sync_status);
`;

async function cleanLegacySpanishTables(db: SQLiteDatabase) {
  try {
    await db.execAsync(`
      DROP TABLE IF EXISTS inventarios;
      DROP TABLE IF EXISTS cajas;
      DROP TABLE IF EXISTS prendas;
    `).catch(() => {});
  } catch (e) {
    console.warn('Legacy table cleanup:', e);
  }
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS user_version (id INTEGER PRIMARY KEY DEFAULT 1, version INTEGER);
  `);

  try {
    await db.execAsync(`ALTER TABLE inventories ADD COLUMN order_index INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    await db.execAsync(`ALTER TABLE boxes ADD COLUMN order_index INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    await db.execAsync(`ALTER TABLE garments ADD COLUMN shipping_at TEXT;`);
  } catch (e) {}
  try {
    await db.execAsync(`UPDATE inventories SET order_index = orden WHERE (order_index IS NULL OR order_index = 0) AND orden IS NOT NULL;`);
  } catch (e) {}
  try {
    await db.execAsync(`UPDATE boxes SET order_index = orden WHERE (order_index IS NULL OR order_index = 0) AND orden IS NOT NULL;`);
  } catch (e) {}

  await db.execAsync(CANONICAL_SCHEMA);

  try {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_inventories_order ON inventories(order_index);
      CREATE INDEX IF NOT EXISTS idx_boxes_order ON boxes(order_index);
    `);
  } catch (e) {}

  await cleanLegacySpanishTables(db);

  await db.runAsync('INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 4);');
}

export const generateId = (): string => {
  return generateUUID();
};