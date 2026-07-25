import { SQLiteDatabase } from 'expo-sqlite';
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 13;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS user_version (id INTEGER PRIMARY KEY DEFAULT 1, version INTEGER);
  `);
  // Auto-corrección garantizada de tablas de Chat, ajustes y campos de sincronización
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    await db.runAsync('ALTER TABLE chat_history ADD COLUMN sessionId TEXT;').catch(() => { });
    await db.runAsync('ALTER TABLE chat_history ADD COLUMN engineUsed TEXT;').catch(() => { });

    // Columnas de sincronización para chat_sessions y chat_history
    await db.runAsync('ALTER TABLE chat_sessions ADD COLUMN user_id TEXT;').catch(() => { });
    await db.runAsync('ALTER TABLE chat_sessions ADD COLUMN updated_at TEXT;').catch(() => { });
    await db.runAsync('ALTER TABLE chat_sessions ADD COLUMN deleted_at TEXT;').catch(() => { });
    await db.runAsync("ALTER TABLE chat_sessions ADD COLUMN sync_status TEXT DEFAULT 'PENDING';").catch(() => { });

    await db.runAsync('ALTER TABLE chat_history ADD COLUMN updated_at TEXT;').catch(() => { });
    await db.runAsync('ALTER TABLE chat_history ADD COLUMN deleted_at TEXT;').catch(() => { });
    await db.runAsync("ALTER TABLE chat_history ADD COLUMN sync_status TEXT DEFAULT 'PENDING';").catch(() => { });
  } catch (e) {
    console.error('Error auto-corrigiendo esquema:', e);
  }
  const result = await db.getFirstAsync<{ version: number }>('SELECT version FROM user_version');
  let currentDbVersion = result ? result.version : 0;
  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }
  if (currentDbVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO app_settings (key, value) VALUES ('themeMode', 'light');
      INSERT OR IGNORE INTO app_settings (key, value) VALUES ('colorScheme', 'morado');
      CREATE TABLE IF NOT EXISTS inventarios (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        fechaCreacion TEXT NOT NULL,
        estado INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT,
        deleted_at TEXT,
        sync_status TEXT DEFAULT 'PENDING'
      );
      CREATE TABLE IF NOT EXISTS cajas (
        id TEXT PRIMARY KEY NOT NULL,
        inventarioId TEXT NOT NULL,
        nombre TEXT NOT NULL,
        fechaCreacion TEXT NOT NULL,
        orden INTEGER DEFAULT 0,
        updated_at TEXT,
        deleted_at TEXT,
        sync_status TEXT DEFAULT 'PENDING',
        FOREIGN KEY (inventarioId) REFERENCES inventarios (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS prendas (
        id TEXT PRIMARY KEY NOT NULL,
        cajaId TEXT NOT NULL,
        op TEXT,
        estilo TEXT NOT NULL,
        color TEXT NOT NULL,
        fotoUri TEXT,
        fotoUri2 TEXT,
        estado INTEGER NOT NULL DEFAULT 1,
        fechaCreacion TEXT NOT NULL,
        alarmaFechaHora TEXT,
        alarmaNotificationId TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        sync_status TEXT DEFAULT 'PENDING',
        FOREIGN KEY (cajaId) REFERENCES cajas (id) ON DELETE CASCADE
      );
      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_cajas_inventario ON cajas(inventarioId);
      CREATE INDEX IF NOT EXISTS idx_prendas_caja ON prendas(cajaId);
      CREATE INDEX IF NOT EXISTS idx_prendas_estado ON prendas(estado);
      CREATE INDEX IF NOT EXISTS idx_prendas_fecha ON prendas(fechaCreacion);
      CREATE INDEX IF NOT EXISTS idx_cajas_orden ON cajas(orden);
      CREATE INDEX IF NOT EXISTS idx_inventarios_user ON inventarios(user_id);
      CREATE INDEX IF NOT EXISTS idx_inventarios_sync ON inventarios(sync_status);
      CREATE INDEX IF NOT EXISTS idx_cajas_sync ON cajas(sync_status);
      CREATE INDEX IF NOT EXISTS idx_prendas_sync ON prendas(sync_status);
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_history (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        matches_json TEXT,
        engineUsed TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES chat_sessions (id) ON DELETE CASCADE
      );
      INSERT OR REPLACE INTO user_version (id, version) VALUES (1, ${DATABASE_VERSION});
    `);
  } else {
    if (currentDbVersion === 1) {
      await db.execAsync(`
        ALTER TABLE prendas ADD COLUMN fechaCreacion TEXT;
        UPDATE prendas SET fechaCreacion = DATETIME(CAST(SUBSTR(id, 1, 10) AS INT), 'unixepoch', 'localtime') WHERE fechaCreacion IS NULL;
        UPDATE prendas SET fechaCreacion = CURRENT_TIMESTAMP WHERE fechaCreacion IS NULL;
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 2);                    
      `);
      currentDbVersion = 2;
    }
    if (currentDbVersion === 2) {
      await db.execAsync(`
        ALTER TABLE cajas ADD COLUMN orden INTEGER DEFAULT 0;
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 3);
      `);
      currentDbVersion = 3;
    }
    if (currentDbVersion === 3) {
      await db.execAsync(`
        DROP TABLE IF EXISTS detalles_prendas;
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 4);
      `);
      currentDbVersion = 4;
    }
    if (currentDbVersion === 4) {
      await db.execAsync(`
        DELETE FROM prendas WHERE cajaId NOT IN (SELECT id FROM cajas);
        DELETE FROM cajas WHERE inventarioId NOT IN (SELECT id FROM inventarios);
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 5);
      `);
      currentDbVersion = 5;
    }
    if (currentDbVersion === 5) {
      await db.execAsync(`
        ALTER TABLE prendas ADD COLUMN fotoUri TEXT;
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 6);
      `);
      currentDbVersion = 6;
    }
    if (currentDbVersion === 6) {
      try {
        await db.runAsync('ALTER TABLE prendas ADD COLUMN fotoUri TEXT;');
      } catch (e) { }
      await db.execAsync(`
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 7);
      `);
      currentDbVersion = 7;
    }
    if (currentDbVersion === 7) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_history (
          id TEXT PRIMARY KEY NOT NULL,
          sender TEXT NOT NULL,
          text TEXT NOT NULL,
          matches_json TEXT,
          timestamp INTEGER NOT NULL
        );
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 8);
      `);
      currentDbVersion = 8;
    }
    if (currentDbVersion === 8) {
      await db.execAsync(`
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 9);
      `);
      currentDbVersion = 9;
    }
    if (currentDbVersion === 9) {
      try {
        await db.runAsync('ALTER TABLE prendas ADD COLUMN fotoUri2 TEXT;');
      } catch (e) { }
      await db.execAsync(`
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 10);
      `);
      currentDbVersion = 10;
    }
    if (currentDbVersion === 10) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );
      `);
      try {
        await db.runAsync('ALTER TABLE chat_history ADD COLUMN sessionId TEXT;');
      } catch (e) { }
      const historyCountResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM chat_history WHERE sessionId IS NULL');
      if (historyCountResult && historyCountResult.count > 0) {
        const defaultSessionId = Date.now().toString();
        await db.runAsync('INSERT INTO chat_sessions (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)', [
          defaultSessionId,
          'Sesión anterior',
          Date.now(),
          Date.now()
        ]);
        await db.runAsync('UPDATE chat_history SET sessionId = ? WHERE sessionId IS NULL', [defaultSessionId]);
      }
      await db.execAsync(`
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 11);
      `);
      currentDbVersion = 11;
    }
    if (currentDbVersion === 11) {
      await db.execAsync(`
        ALTER TABLE prendas ADD COLUMN alarmaFechaHora TEXT;
        ALTER TABLE prendas ADD COLUMN alarmaNotificationId TEXT;
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 12);
      `);
      currentDbVersion = 12;
    }
    if (currentDbVersion === 12) {
      // Migración v13: Agregar campos de sincronización
      try {
        await db.runAsync('ALTER TABLE inventarios ADD COLUMN user_id TEXT;');
      } catch (e) { }
      try {
        await db.runAsync('ALTER TABLE inventarios ADD COLUMN updated_at TEXT;');
      } catch (e) { }
      try {
        await db.runAsync('ALTER TABLE inventarios ADD COLUMN deleted_at TEXT;');
      } catch (e) { }
      try {
        await db.runAsync("ALTER TABLE inventarios ADD COLUMN sync_status TEXT DEFAULT 'PENDING';");
      } catch (e) { }
      try {
        await db.runAsync('ALTER TABLE cajas ADD COLUMN updated_at TEXT;');
      } catch (e) { }
      try {
        await db.runAsync('ALTER TABLE cajas ADD COLUMN deleted_at TEXT;');
      } catch (e) { }
      try {
        await db.runAsync("ALTER TABLE cajas ADD COLUMN sync_status TEXT DEFAULT 'PENDING';");
      } catch (e) { }
      try {
        await db.runAsync('ALTER TABLE prendas ADD COLUMN updated_at TEXT;');
      } catch (e) { }
      try {
        await db.runAsync('ALTER TABLE prendas ADD COLUMN deleted_at TEXT;');
      } catch (e) { }
      try {
        await db.runAsync("ALTER TABLE prendas ADD COLUMN sync_status TEXT DEFAULT 'PENDING';");
      } catch (e) { }
      // Asegurar valores por defecto para registros antiguos
      await db.runAsync('UPDATE inventarios SET updated_at = fechaCreacion WHERE updated_at IS NULL;');
      await db.runAsync('UPDATE cajas SET updated_at = fechaCreacion WHERE updated_at IS NULL;');
      await db.runAsync('UPDATE prendas SET updated_at = fechaCreacion WHERE updated_at IS NULL;');
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_inventarios_user ON inventarios(user_id);
        CREATE INDEX IF NOT EXISTS idx_inventarios_sync ON inventarios(sync_status);
        CREATE INDEX IF NOT EXISTS idx_cajas_sync ON cajas(sync_status);
        CREATE INDEX IF NOT EXISTS idx_prendas_sync ON prendas(sync_status);
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 13);
      `);
      currentDbVersion = 13;
    }
  }
}
export const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};