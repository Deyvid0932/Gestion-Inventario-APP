import { SQLiteDatabase } from 'expo-sqlite';

export interface CajaTopData {
  nombre: string;
  total: number;
}

export interface ColorBreakdownData {
  color: string;
  count: number;
}

export interface DashboardStats {
  totalInventarios: number;
  totalCajas: number;
  totalPrendas: number;
  prendasActivas: number;
  prendasInactivas: number;
  prendasConFoto: number;
  prendasConAlarma: number;
  cajaTopNombre: string;
  cajaTopCantidad: number;
  top5Cajas: CajaTopData[];
  topColores: ColorBreakdownData[];
}

export const StatsService = {
  getStats: async (db: SQLiteDatabase, userId?: string | null): Promise<DashboardStats> => {
    try {
      const stats: DashboardStats = {
        totalInventarios: 0,
        totalCajas: 0,
        totalPrendas: 0,
        prendasActivas: 0,
        prendasInactivas: 0,
        prendasConFoto: 0,
        prendasConAlarma: 0,
        cajaTopNombre: 'Ninguna',
        cajaTopCantidad: 0,
        top5Cajas: [],
        topColores: [],
      };

      const userFilter = userId
        ? `(i.user_id = '${userId}' OR i.user_id IS NULL OR i.user_id = '')`
        : `(i.user_id IS NULL OR i.user_id = '')`;

      const combinedQuery = `
        SELECT 
          (SELECT COUNT(*) FROM inventarios i WHERE ${userFilter}) as totalInventarios,
          (SELECT COUNT(*) FROM cajas c JOIN inventarios i ON c.inventarioId = i.id WHERE ${userFilter}) as totalCajas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE ${userFilter}) as totalPrendas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.estado = 1 AND ${userFilter}) as prendasActivas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.estado = 0 AND ${userFilter}) as prendasInactivas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE ((p.fotoUri IS NOT NULL AND p.fotoUri != '') OR (p.fotoUri2 IS NOT NULL AND p.fotoUri2 != '') OR (p.r2Key IS NOT NULL AND p.r2Key != '')) AND ${userFilter}) as prendasConFoto,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.alarmaFechaHora IS NOT NULL AND p.alarmaFechaHora != '' AND ${userFilter}) as prendasConAlarma
      `;

      const counts = await db.getFirstAsync<{
        totalInventarios: number;
        totalCajas: number;
        totalPrendas: number;
        prendasActivas: number;
        prendasInactivas: number;
        prendasConFoto: number;
        prendasConAlarma: number;
      }>(combinedQuery);

      if (counts) {
        stats.totalInventarios = counts.totalInventarios;
        stats.totalCajas = counts.totalCajas;
        stats.totalPrendas = counts.totalPrendas;
        stats.prendasActivas = counts.prendasActivas;
        stats.prendasInactivas = counts.prendasInactivas;
        stats.prendasConFoto = counts.prendasConFoto;
        stats.prendasConAlarma = counts.prendasConAlarma;
      }

      const topResult = await db.getAllAsync<{ nombre: string; total: number }>(`
        SELECT c.nombre, COUNT(*) as total 
        FROM prendas p 
        JOIN cajas c ON p.cajaId = c.id 
        JOIN inventarios i ON c.inventarioId = i.id
        WHERE ${userFilter}
        GROUP BY p.cajaId 
        ORDER BY total DESC 
        LIMIT 5
      `);

      if (topResult && topResult.length > 0) {
        stats.cajaTopNombre = topResult[0].nombre;
        stats.cajaTopCantidad = topResult[0].total;
        stats.top5Cajas = topResult;
      }

      const colorResult = await db.getAllAsync<{ color: string; count: number }>(`
        SELECT p.color, COUNT(*) as count 
        FROM prendas p 
        JOIN cajas c ON p.cajaId = c.id 
        JOIN inventarios i ON c.inventarioId = i.id
        WHERE ${userFilter} AND p.color IS NOT NULL AND p.color != ''
        GROUP BY p.color 
        ORDER BY count DESC 
        LIMIT 5
      `);

      if (colorResult) {
        stats.topColores = colorResult;
      }

      return stats;
    } catch (e) {
      console.error('Error fetching stats:', e);
      return {
        totalInventarios: 0,
        totalCajas: 0,
        totalPrendas: 0,
        prendasActivas: 0,
        prendasInactivas: 0,
        prendasConFoto: 0,
        prendasConAlarma: 0,
        cajaTopNombre: 'Ninguna',
        cajaTopCantidad: 0,
        top5Cajas: [],
        topColores: [],
      };
    }
  }
};
