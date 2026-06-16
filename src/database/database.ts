import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 5;
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS user_version (id INTEGER PRIMARY KEY DEFAULT 1, version INTEGER);
  `);

  const result = await db.getFirstAsync<{ version: number }>('SELECT version FROM user_version');
  let currentDbVersion = result ? result.version : 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS inventarios (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        fechaCreacion TEXT NOT NULL,
        estado INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS cajas (
        id TEXT PRIMARY KEY NOT NULL,
        inventarioId TEXT NOT NULL,
        nombre TEXT NOT NULL,
        fechaCreacion TEXT NOT NULL,
        orden INTEGER DEFAULT 0,
        FOREIGN KEY (inventarioId) REFERENCES inventarios (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS prendas (
        id TEXT PRIMARY KEY NOT NULL,
        cajaId TEXT NOT NULL,
        op TEXT,
        estilo TEXT NOT NULL,
        color TEXT NOT NULL,
        estado INTEGER NOT NULL DEFAULT 1,
        fechaCreacion TEXT NOT NULL,
        FOREIGN KEY (cajaId) REFERENCES cajas (id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_cajas_inventario ON cajas(inventarioId);
      CREATE INDEX IF NOT EXISTS idx_prendas_caja ON prendas(cajaId);
      CREATE INDEX IF NOT EXISTS idx_prendas_estado ON prendas(estado);
      CREATE INDEX IF NOT EXISTS idx_prendas_fecha ON prendas(fechaCreacion);
      CREATE INDEX IF NOT EXISTS idx_cajas_orden ON cajas(orden);

      INSERT OR REPLACE INTO user_version (id, version) VALUES (1, ${DATABASE_VERSION});
    `);
  } else {
    if (currentDbVersion === 1) {
      await db.execAsync(`
        ALTER TABLE prendas ADD COLUMN fechaCreacion TEXT;
        UPDATE prendas SET fechaCreacion = DATETIME(CAST(SUBSTR(id, 1, 10) AS INT), 'unixepoch', 'localtime') WHERE fechaCreacion IS NULL;
        UPDATE prendas SET fechaCreacion = CURRENT_TIMESTAMP WHERE fechaCreacion IS NULL;
        CREATE INDEX IF NOT EXISTS idx_cajas_inventario ON cajas(inventarioId);
        CREATE INDEX IF NOT EXISTS idx_prendas_caja ON prendas(cajaId);
        CREATE INDEX IF NOT EXISTS idx_prendas_estado ON prendas(estado);
        CREATE INDEX IF NOT EXISTS idx_prendas_fecha ON prendas(fechaCreacion);
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 2);                    
      `);
      currentDbVersion = 2;
    }

    if (currentDbVersion === 2) {
      await db.execAsync(`
        ALTER TABLE cajas ADD COLUMN orden INTEGER DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_cajas_orden ON cajas(orden);
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
        -- Limpieza de datos huérfanos
        DELETE FROM prendas WHERE cajaId NOT IN (SELECT id FROM cajas);
        DELETE FROM cajas WHERE inventarioId NOT IN (SELECT id FROM inventarios);
        
        INSERT OR REPLACE INTO user_version (id, version) VALUES (1, 5);
      `);
      currentDbVersion = 5;
    }
  }
}

export const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};
