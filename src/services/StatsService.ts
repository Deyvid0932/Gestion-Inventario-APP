import { SQLiteDatabase } from 'expo-sqlite';

export interface CajaTopData {
  nombre: string;
  total: number;
}

export interface ColorBreakdownData {
  color: string;
  count: number;
}

export interface DailyTrendData {
  dayLabel: string;
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
  weeklyTrend?: DailyTrendData[];
}

export const StatsService = {
  getStats: async (db: SQLiteDatabase, _userId?: string | null): Promise<DashboardStats> => {
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
        weeklyTrend: [],
      };

      const userFilter = '1=1';

      const combinedQuery = `
        SELECT 
          (SELECT COUNT(*) FROM inventarios i WHERE ${userFilter} AND i.deleted_at IS NULL) as totalInventarios,
          (SELECT COUNT(*) FROM cajas c JOIN inventarios i ON c.inventarioId = i.id WHERE ${userFilter} AND c.deleted_at IS NULL AND i.deleted_at IS NULL) as totalCajas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE ${userFilter} AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL) as totalPrendas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.estado = 1 AND ${userFilter} AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL) as prendasActivas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.estado = 0 AND ${userFilter} AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL) as prendasInactivas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE ((p.fotoUri IS NOT NULL AND p.fotoUri != '') OR (p.fotoUri2 IS NOT NULL AND p.fotoUri2 != '') OR (p.r2Key IS NOT NULL AND p.r2Key != '')) AND ${userFilter} AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL) as prendasConFoto,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.alarmaFechaHora IS NOT NULL AND p.alarmaFechaHora != '' AND ${userFilter} AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL) as prendasConAlarma
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
        WHERE ${userFilter} AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL
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
        WHERE ${userFilter} AND p.color IS NOT NULL AND p.color != '' AND p.deleted_at IS NULL AND c.deleted_at IS NULL AND i.deleted_at IS NULL
        GROUP BY p.color 
        ORDER BY count DESC 
        LIMIT 5
      `);

      if (colorResult) {
        stats.topColores = colorResult;
      }

      // Tendencia semanal (Últimos 7 días mapeados a HORA LOCAL del usuario)
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const now = new Date();
      const weeklyMap: { [ymd: string]: { dayLabel: string; count: number } } = {};
      const orderKeys: string[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        const ymdKey = `${y}-${m}-${dayNum}`;
        const dayLabel = dayNames[d.getDay()];

        weeklyMap[ymdKey] = { dayLabel, count: 0 };
        orderKeys.push(ymdKey);
      }

      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const recentPrendas = await db.getAllAsync<{ fechaCreacion: string }>(
        `SELECT fechaCreacion FROM prendas WHERE deleted_at IS NULL AND fechaCreacion >= ?`,
        [sevenDaysAgoISO]
      );

      if (recentPrendas && recentPrendas.length > 0) {
        recentPrendas.forEach(p => {
          if (!p.fechaCreacion) return;
          const pDate = new Date(p.fechaCreacion);
          const y = pDate.getFullYear();
          const m = String(pDate.getMonth() + 1).padStart(2, '0');
          const dayNum = String(pDate.getDate()).padStart(2, '0');
          const pYmdKey = `${y}-${m}-${dayNum}`;

          if (weeklyMap[pYmdKey]) {
            weeklyMap[pYmdKey].count++;
          }
        });
      }

      stats.weeklyTrend = orderKeys.map(k => weeklyMap[k]);

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
        weeklyTrend: [],
      };
    }
  }
};
