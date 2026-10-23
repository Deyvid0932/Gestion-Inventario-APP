# Manual de Operaciones Masivas, Importación y Exportación Excel — Topytop Kith

## 1. Importación Masiva de Semillas (`ExcelImportService`)

Para facilitar el despliegue inicial en nuevas plantas o pruebas de auditoría a gran escala, la aplicación incluye un motor de inserción atómica de datos precargados.

### 1.1. Dataset Inicial de Semillas (`initialInventorySeed.ts`)
* **Volumen:** 629 prendas textiles distribuidas en 21 cajas.
* **Estructura:** Cada registro contiene su Orden de Producción (OP), código de estilo textil (KH), color normalizado, talla y caja asignada.

### 1.2. Inserción Atómica Ultra Rápida (< 1 Segundo)
En lugar de realizar 629 consultas individuales que bloquearían la interfaz móvil durante 10 a 15 segundos, [`ExcelImportService.ts`](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/src/services/inventory/ExcelImportService.ts) ejecuta todo dentro de una **transacción atómica única**:

```ts
await db.withTransactionAsync(async () => {
  // 1. Mapeo en memoria RAM de inventarios y cajas existentes
  const invMap = new Map<string, string>();
  const boxMap = new Map<string, string>();
  
  // 2. Iteración masiva sobre los 629 registros
  for (const seedBox of INITIAL_INVENTORY_SEED) {
    // Inserción o reutilización de Lote
    // Inserción o reutilización de Caja
    // Inserción en bloque de prendas con sync_status = 'PENDING'
  }
});
```

* **Rendimiento:** La transacción completa toma entre **400 ms y 850 ms** en dispositivos Android de gama media.
* **Sincronización Inmediata:** Al terminar la transacción, se notifica a `SyncScheduler` para programar la subida a Supabase sin interferir con la navegación del usuario.

---

## 2. Motor de Exportación a Excel (`exportToExcel`)

Ubicado en [`src/utils/export.ts`](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/src/utils/export.ts), este módulo genera archivos `.xlsx` reales en el almacenamiento del teléfono y los comparte utilizando la hoja nativa de compartir del sistema operativo.

### 2.1. Modalidades de Exportación

#### Modalidad A: Hojas Separadas por Caja (`separateBySheet = true`, Predeterminada)
* Crea una pestaña independiente en el libro Excel para cada caja seleccionada (ej. `CAJA 01`, `CAJA 02`).
* El nombre de la pestaña se sanitiza para cumplir con el límite estricto de 31 caracteres de Microsoft Excel (`name.substring(0, 31)`).
* Aplica un encabezado combinado con el nombre de la caja, fila de títulos en mayúsculas (`OP`, `ESTILO`, `COLOR`, `TALLA`) y columnas con ancho de 15 caracteres.

#### Modalidad B: Hoja Única Agrupada (`separateBySheet = false`)
* Agrupa todas las prendas en una sola hoja continua, separando cada caja mediante un título fusionado y dos filas en blanco de separación visual.

### 2.2. Flujo de Generación y Compartido
```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Modal as ExportModal
    participant Util as exportToExcel (SheetJS)
    participant FS as expo-file-system
    participant Share as expo-sharing

    Usuario->>Modal: Selecciona Lotes/Cajas y pulsa "Exportar"
    Modal->>Util: exportToExcel(data, fileName, separateBySheet)
    Util->>Util: Agrupa datos por _box_name y genera Workbook XLSX
    Util->>FS: Escribe archivo binario base64 en cacheDirectory
    Util->>Share: shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats...' })
    Share-->>Usuario: Despliega menú nativo (WhatsApp, Gmail, Drive, Guardar en Disco)
```

---

## 3. Gestión de Papelera y Ciclo de Eliminación

Para prevenir pérdidas accidentales de información por errores humanos en planta, la aplicación implementa un ciclo de borrado en dos fases:

### 3.1. Borrado Lógico (*Soft Delete*)
* Cuando un usuario elimina una prenda o caja, **no se borra de la base de datos**.
* Se asigna la fecha y hora actual en la columna `deleted_at` (`datetime('now')`).
* Todas las consultas del inventario activo filtran automáticamente: `WHERE deleted_at IS NULL`.
* El elemento se traslada a la pantalla de Papelera ([`TrashScreen.tsx`](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/src/screens/TrashScreen.tsx)), donde cualquier usuario con rol `Editor` o `Admin` puede restaurarlo con un solo toque.

### 3.2. Borrado Físico y Cola `pending_deletions` (*Permanent Delete*)
* Exclusivo para usuarios con rol **`Admin`**.
* Al vaciar la papelera o eliminar definitivamente:
  1. Se eliminan las filas en SQLite (`DELETE FROM garments WHERE id = ?`).
  2. Si hay fotografías asociadas, se inserta una orden en `pending_deletions` para que el motor destruya los binarios en Cloudflare R2 y la base remota de Supabase al sincronizar.
