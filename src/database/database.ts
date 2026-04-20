import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS user_version (version INTEGER);
  `);

  const result = await db.getFirstAsync<{ version: number }>('SELECT version FROM user_version');
  let currentDbVersion = result ? result.version : 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      DROP TABLE IF EXISTS prendas;
      DROP TABLE IF EXISTS cajas;
      DROP TABLE IF EXISTS inventarios;
      PRAGMA foreign_keys = ON;

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
        FOREIGN KEY (inventarioId) REFERENCES inventarios (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS prendas (
        id TEXT PRIMARY KEY NOT NULL,
        cajaId TEXT NOT NULL,
        op TEXT,
        estilo TEXT NOT NULL,
        color TEXT NOT NULL,
        estado INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (cajaId) REFERENCES cajas (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS detalles_prendas (
        id TEXT PRIMARY KEY NOT NULL,
        op TEXT,
        estilo TEXT NOT NULL,
        color TEXT NOT NULL,
        estado INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO user_version (version) VALUES (${DATABASE_VERSION});
    `);
    currentDbVersion = 1;
  }
  
}



// Funciones Helper para Generación de IDs
export const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};


