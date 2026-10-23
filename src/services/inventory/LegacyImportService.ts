import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { withSerializedTransaction } from '../../database/serializedTransaction';

type LegacyInventory = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  fechaCreacion?: string | null;
  estado?: number | null;
};

type LegacyBox = {
  id: string;
  inventarioId: string;
  nombre: string;
  fechaCreacion?: string | null;
  orden?: number | null;
};

type LegacyGarment = {
  id: string;
  cajaId: string;
  op?: string | null;
  estilo?: string | null;
  color?: string | null;
  estado?: number | null;
  fechaCreacion?: string | null;
  photoFile1?: string | null;
  photoFile2?: string | null;
};

type LegacyBundle = {
  format: string;
  version: number;
  inventories: LegacyInventory[];
  boxes: LegacyBox[];
  garments: LegacyGarment[];
};

export interface LegacyImportResult {
  success: boolean;
  canceled?: boolean;
  importedInventories: number;
  importedBoxes: number;
  importedGarments: number;
  matchedGarments: number;
  importedPhotos: number;
  skippedPhotos: number;
  failedPhotos: number;
  error?: string;
}

const emptyResult = (): LegacyImportResult => ({
  success: false,
  importedInventories: 0,
  importedBoxes: 0,
  importedGarments: 0,
  matchedGarments: 0,
  importedPhotos: 0,
  skippedPhotos: 0,
  failedPhotos: 0,
});

const normalize = (value?: string | null): string =>
  (value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const childName = (uri: string): string => {
  const decoded = decodeURIComponent(uri).split('?')[0].replace(/\/$/, '');
  return decoded.slice(decoded.lastIndexOf('/') + 1);
};

const safeFileName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);

const garmentKey = (
  boxId: string,
  op?: string | null,
  style?: string | null,
  color?: string | null,
): string => [boxId, normalize(op), normalize(style), normalize(color)].join('|');

export const LegacyImportService = {
  importFromSelectedFolder: async (
    db: SQLiteDatabase,
    userId?: string | null,
  ): Promise<LegacyImportResult> => {
    const result = emptyResult();

    try {
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) {
        return { ...result, canceled: true, error: 'Selección de carpeta cancelada.' };
      }

      const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(permission.directoryUri);
      const filesByName = new Map(children.map(uri => [childName(uri), uri]));
      const migrationUri = filesByName.get('migration-data.json');
      if (!migrationUri) {
        return {
          ...result,
          error: 'La carpeta seleccionada no contiene migration-data.json.',
        };
      }

      const rawBundle = await FileSystem.readAsStringAsync(migrationUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const bundle = JSON.parse(rawBundle) as LegacyBundle;
      if (
        bundle.format !== 'topytop-legacy-migration' ||
        bundle.version !== 1 ||
        !Array.isArray(bundle.inventories) ||
        !Array.isArray(bundle.boxes) ||
        !Array.isArray(bundle.garments)
      ) {
        return { ...result, error: 'El respaldo seleccionado no tiene un formato compatible.' };
      }

      const permanentDirectory = `${FileSystem.documentDirectory}legacy-import/`;
      await FileSystem.makeDirectoryAsync(permanentDirectory, { intermediates: true });

      const copiedPhotos = new Map<string, string>();
      for (const garment of bundle.garments) {
        for (const slot of [1, 2] as const) {
          const sourceName = slot === 1 ? garment.photoFile1 : garment.photoFile2;
          if (!sourceName) continue;

          const sourceUri = filesByName.get(sourceName);
          if (!sourceUri) {
            result.failedPhotos += 1;
            continue;
          }

          const destination = `${permanentDirectory}${safeFileName(sourceName)}`;
          try {
            const base64 = await FileSystem.readAsStringAsync(sourceUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await FileSystem.writeAsStringAsync(destination, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            copiedPhotos.set(`${garment.id}:${slot}`, destination);
          } catch (error) {
            console.warn('[LegacyImport] No se pudo copiar una foto:', sourceName, error);
            result.failedPhotos += 1;
          }
        }
      }

      const now = new Date().toISOString();
      await withSerializedTransaction(db, async () => {
        const existingInventories = await db.getAllAsync<{ id: string; name: string }>(
          'SELECT id, name FROM inventories WHERE deleted_at IS NULL',
        );
        const inventoryIds = new Set(existingInventories.map(item => item.id));
        const inventoryByName = new Map(
          existingInventories.map(item => [normalize(item.name), item.id]),
        );
        const mappedInventoryIds = new Map<string, string>();

        for (const inventory of bundle.inventories) {
          let targetId = inventoryIds.has(inventory.id)
            ? inventory.id
            : inventoryByName.get(normalize(inventory.nombre));
          if (!targetId) {
            targetId = inventory.id;
            await db.runAsync(
              `INSERT INTO inventories
                (id, user_id, name, description, created_at, order_index, status, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'PENDING')`,
              [
                targetId,
                userId || null,
                inventory.nombre || 'Inventario recuperado',
                inventory.descripcion || 'Recuperado de la aplicación antigua',
                inventory.fechaCreacion || now,
                inventory.estado === 0 ? 0 : 1,
                now,
              ],
            );
            result.importedInventories += 1;
            inventoryIds.add(targetId);
            inventoryByName.set(normalize(inventory.nombre), targetId);
          }
          mappedInventoryIds.set(inventory.id, targetId);
        }

        const existingBoxes = await db.getAllAsync<{
          id: string;
          inventory_id: string;
          name: string;
        }>('SELECT id, inventory_id, name FROM boxes WHERE deleted_at IS NULL');
        const boxIds = new Set(existingBoxes.map(item => item.id));
        const boxByName = new Map(
          existingBoxes.map(item => [
            `${item.inventory_id}|${normalize(item.name)}`,
            item.id,
          ]),
        );
        const mappedBoxIds = new Map<string, string>();

        for (const box of bundle.boxes) {
          const inventoryId = mappedInventoryIds.get(box.inventarioId);
          if (!inventoryId) continue;
          let targetId = boxIds.has(box.id)
            ? box.id
            : boxByName.get(`${inventoryId}|${normalize(box.nombre)}`);
          if (!targetId) {
            targetId = box.id;
            await db.runAsync(
              `INSERT INTO boxes
                (id, inventory_id, name, created_at, order_index, status, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, 1, ?, 'PENDING')`,
              [
                targetId,
                inventoryId,
                box.nombre || 'Caja recuperada',
                box.fechaCreacion || now,
                box.orden ?? 0,
                now,
              ],
            );
            result.importedBoxes += 1;
            boxIds.add(targetId);
            boxByName.set(`${inventoryId}|${normalize(box.nombre)}`, targetId);
          }
          mappedBoxIds.set(box.id, targetId);
        }

        const existingGarments = await db.getAllAsync<{
          id: string;
          box_id: string;
          op?: string | null;
          style?: string | null;
          color?: string | null;
        }>('SELECT id, box_id, op, style, color FROM garments WHERE deleted_at IS NULL');
        const garmentIds = new Set(existingGarments.map(item => item.id));
        const garmentsByKey = new Map<string, string[]>();
        for (const garment of existingGarments) {
          const key = garmentKey(garment.box_id, garment.op, garment.style, garment.color);
          const values = garmentsByKey.get(key) || [];
          values.push(garment.id);
          garmentsByKey.set(key, values);
        }

        const existingImages = await db.getAllAsync<{
          id: string;
          garment_id: string;
          order_index: number;
          uri?: string | null;
          storage_key?: string | null;
        }>('SELECT id, garment_id, order_index, uri, storage_key FROM garment_images WHERE deleted_at IS NULL');
        const imageBySlot = new Map(
          existingImages.map(image => [`${image.garment_id}:${image.order_index}`, image]),
        );
        const usedGarmentIds = new Set<string>();

        for (const garment of bundle.garments) {
          const boxId = mappedBoxIds.get(garment.cajaId);
          if (!boxId) continue;

          let targetId: string | undefined;
          if (garmentIds.has(garment.id) && !usedGarmentIds.has(garment.id)) {
            targetId = garment.id;
          } else {
            const candidates = garmentsByKey.get(
              garmentKey(boxId, garment.op, garment.estilo, garment.color),
            ) || [];
            targetId = candidates.find(id => !usedGarmentIds.has(id));
          }

          if (targetId) {
            result.matchedGarments += 1;
          } else {
            targetId = garment.id;
            if (garmentIds.has(targetId)) targetId = `legacy_${garment.id}`;
            await db.runAsync(
              `INSERT INTO garments
                (id, box_id, op, style, color, size, status, created_at, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'PENDING')`,
              [
                targetId,
                boxId,
                garment.op || '',
                garment.estilo || '',
                garment.color || '',
                garment.estado === 0 ? 0 : 1,
                garment.fechaCreacion || now,
                now,
              ],
            );
            garmentIds.add(targetId);
            result.importedGarments += 1;
          }
          usedGarmentIds.add(targetId);

          let garmentHasNewPhoto = false;
          for (const slot of [1, 2] as const) {
            const uri = copiedPhotos.get(`${garment.id}:${slot}`);
            if (!uri) continue;
            const orderIndex = slot - 1;
            const existingImage = imageBySlot.get(`${targetId}:${orderIndex}`);
            if (existingImage && (existingImage.uri || existingImage.storage_key)) {
              result.skippedPhotos += 1;
              continue;
            }

            if (existingImage) {
              await db.runAsync(
                `UPDATE garment_images
                 SET uri = ?, storage = 'LOCAL', is_primary = ?, updated_at = ?, sync_status = 'PENDING'
                 WHERE id = ?`,
                [uri, slot === 1 ? 1 : 0, now, existingImage.id],
              );
            } else {
              const imageId = `legacy_img_${targetId}_${slot}`;
              await db.runAsync(
                `INSERT OR IGNORE INTO garment_images
                  (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, NULL, 'LOCAL', ?, ?, ?, ?, 'PENDING')`,
                [
                  imageId,
                  targetId,
                  uri,
                  orderIndex,
                  slot === 1 ? 1 : 0,
                  garment.fechaCreacion || now,
                  now,
                ],
              );
              imageBySlot.set(`${targetId}:${orderIndex}`, {
                id: imageId,
                garment_id: targetId,
                order_index: orderIndex,
                uri,
              });
            }
            garmentHasNewPhoto = true;
            result.importedPhotos += 1;
          }

          if (garmentHasNewPhoto) {
            await db.runAsync(
              `UPDATE garments SET updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
              [now, targetId],
            );
          }
        }
      });

      if (userId) SyncScheduler.schedulePush(db, userId);
      return { ...result, success: true };
    } catch (error: any) {
      console.error('[LegacyImport] Error:', error);
      return { ...result, error: error?.message || 'No se pudo importar el respaldo antiguo.' };
    }
  },
};
