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

      await db.withTransactionAsync(async () => {
        const invResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM inventarios');
        if (invResult) stats.totalInventarios = invResult.count;

        const cajasResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cajas');
        if (cajasResult) stats.totalCajas = cajasResult.count;

        const prendasResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM prendas');
        if (prendasResult) stats.totalPrendas = prendasResult.count;

        const activasResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM prendas WHERE estado = 1');
        if (activasResult) stats.prendasActivas = activasResult.count;

        const inactivasResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM prendas WHERE estado = 0');
        if (inactivasResult) stats.prendasInactivas = inactivasResult.count;

        const fotoResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM prendas WHERE fotoUri IS NOT NULL');
        if (fotoResult) stats.prendasConFoto = fotoResult.count;

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
      });

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
