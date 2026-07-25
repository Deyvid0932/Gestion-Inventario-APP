import { SQLiteDatabase } from 'expo-sqlite';

export interface CajaTopData {
  nombre: string;
  total: number;
}

export interface DashboardStats {
  totalInventarios: number;
  totalCajas: number;
  totalPrendas: number;
  prendasActivas: number;
  prendasInactivas: number;
  prendasConFoto: number;
  cajaTopNombre: string;
  cajaTopCantidad: number;
  top5Cajas: CajaTopData[];
}

export const StatsService = {
  getStats: async (db: SQLiteDatabase): Promise<DashboardStats> => {
    try {
      const stats: DashboardStats = {
        totalInventarios: 0,
        totalCajas: 0,
        totalPrendas: 0,
        prendasActivas: 0,
        prendasInactivas: 0,
        prendasConFoto: 0,
        cajaTopNombre: 'Ninguna',
        cajaTopCantidad: 0,
        top5Cajas: [],
      };

      const combinedQuery = `
        SELECT 
          (SELECT COUNT(*) FROM inventarios) as totalInventarios,
          (SELECT COUNT(*) FROM cajas) as totalCajas,
          (SELECT COUNT(*) FROM prendas) as totalPrendas,
          (SELECT COUNT(*) FROM prendas WHERE estado = 1) as prendasActivas,
          (SELECT COUNT(*) FROM prendas WHERE estado = 0) as prendasInactivas,
          (SELECT COUNT(*) FROM prendas WHERE (fotoUri IS NOT NULL AND fotoUri != '') OR (fotoUri2 IS NOT NULL AND fotoUri2 != '')) as prendasConFoto
      `;

      const counts = await db.getFirstAsync<{
        totalInventarios: number;
        totalCajas: number;
        totalPrendas: number;
        prendasActivas: number;
        prendasInactivas: number;
        prendasConFoto: number;
      }>(combinedQuery);

      if (counts) {
        stats.totalInventarios = counts.totalInventarios;
        stats.totalCajas = counts.totalCajas;
        stats.totalPrendas = counts.totalPrendas;
        stats.prendasActivas = counts.prendasActivas;
        stats.prendasInactivas = counts.prendasInactivas;
        stats.prendasConFoto = counts.prendasConFoto;
      }

      const topResult = await db.getAllAsync<{ nombre: string, total: number }>(`
        SELECT c.nombre, COUNT(*) as total 
        FROM prendas p 
        JOIN cajas c ON p.cajaId = c.id 
        GROUP BY p.cajaId 
        ORDER BY total DESC 
        LIMIT 5
        `);

        if (topResult && topResult.length > 0) {
          stats.cajaTopNombre = topResult[0].nombre;
          stats.cajaTopCantidad = topResult[0].total;
          stats.top5Cajas = topResult;
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
        cajaTopNombre: 'Error',
        cajaTopCantidad: 0,
        top5Cajas: [],
      };
    }
  }
};
