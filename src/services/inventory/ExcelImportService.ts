import { SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from '../../utils/uuid';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { INITIAL_INVENTORY_SEED } from '../../data/initialInventorySeed';
import { withSerializedTransaction } from '../../database/serializedTransaction';

export interface ImportResult {
  success: boolean;
  importedGarments: number;
  importedBoxes: number;
  importedInventories: number;
  skippedGarments?: number;
  error?: string;
}

export const ExcelImportService = {
  /**
   * Importa las 629 prendas y 21 cajas pre-cargadas desde el reporte inicial.
   * Ejecuta todo dentro de una única transacción SQLite atómica para máxima velocidad (< 1 segundo).
   */
  importSeedInventory: async (
    db: SQLiteDatabase,
    userId?: string | null
  ): Promise<ImportResult> => {
    try {
      const now = new Date().toISOString();
      let importedGarments = 0;
      let importedBoxes = 0;
      let importedInventories = 0;
      let skippedGarments = 0;

      await withSerializedTransaction(db, async () => {
        // Cachear inventarios existentes
        const existingInvs = await db.getAllAsync<{ id: string; name: string }>(
          'SELECT id, name FROM inventories WHERE deleted_at IS NULL'
        );
        const invMap = new Map<string, string>();
        existingInvs.forEach(inv => invMap.set(inv.name.trim().toUpperCase(), inv.id));

        // Cachear cajas existentes
        const existingBoxes = await db.getAllAsync<{ id: string; inventory_id: string; name: string }>(
          'SELECT id, inventory_id, name FROM boxes WHERE deleted_at IS NULL'
        );
        const boxMap = new Map<string, string>();
        existingBoxes.forEach(b => boxMap.set(`${b.inventory_id}_${b.name.trim().toUpperCase()}`, b.id));

        for (const seedBox of INITIAL_INVENTORY_SEED) {
          const invNameNorm = seedBox.inventoryName.trim().toUpperCase();
          let invId = invMap.get(invNameNorm);

          // 1. Crear inventario si no existe
          if (!invId) {
            invId = generateUUID();
            await db.runAsync(
              `INSERT INTO inventories (id, user_id, name, description, created_at, order_index, status, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, 0, 1, ?, 'PENDING')`,
              [invId, userId || null, seedBox.inventoryName, 'Importado desde reporte Excel', now, now]
            );
            invMap.set(invNameNorm, invId);
            importedInventories++;
          }

          // 2. Crear caja si no existe
          const boxKey = `${invId}_${seedBox.boxName.trim().toUpperCase()}`;
          let boxId = boxMap.get(boxKey);

          if (!boxId) {
            boxId = generateUUID();
            await db.runAsync(
              `INSERT INTO boxes (id, inventory_id, name, created_at, order_index, status, updated_at, sync_status)
               VALUES (?, ?, ?, ?, 0, 1, ?, 'PENDING')`,
              [boxId, invId, seedBox.boxName, now, now]
            );
            boxMap.set(boxKey, boxId);
            importedBoxes++;
          }

          // 3. Insertar prendas de esta caja
          for (const g of seedBox.garments) {
            // Verificar si ya existe prenda con la misma OP en esta caja para no duplicar
            if (g.op && g.op.trim() !== '') {
              const existingG = await db.getFirstAsync<{ id: string }>(
                'SELECT id FROM garments WHERE box_id = ? AND op = ? AND deleted_at IS NULL',
                [boxId, g.op]
              );
              if (existingG) {
                skippedGarments++;
                continue;
              }
            }

            const garmentId = generateUUID();
            await db.runAsync(
              `INSERT INTO garments (id, box_id, op, style, color, size, status, created_at, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, '', 1, ?, ?, 'PENDING')`,
              [garmentId, boxId, g.op || '', g.style, g.color, now, now]
            );
            importedGarments++;
          }
        }
      });

      // Programar sincronización hacia Supabase
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      console.log(`[ExcelImportService] ✅ Importación completada: ${importedGarments} prendas, ${importedBoxes} cajas, ${importedInventories} inventarios.`);
      return {
        success: true,
        importedGarments,
        importedBoxes,
        importedInventories,
        skippedGarments,
      };
    } catch (e: any) {
      console.error('[ExcelImportService] ❌ Error en importación:', e);
      return {
        success: false,
        importedGarments: 0,
        importedBoxes: 0,
        importedInventories: 0,
        error: e.message || 'Error al importar datos a SQLite',
      };
    }
  },
};
