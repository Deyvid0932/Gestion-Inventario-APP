import { SQLiteDatabase } from 'expo-sqlite';

export interface DashboardTotals {
  totalLotes: number;
  totalCajas: number;
  totalPrendas: number;
  totalAlarmas: number;
}

export interface ActivityItem {
  id: string;
  type: 'PRENDA' | 'SYNC' | 'OCR';
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
}

export const DashboardService = {
  getTotals: async (db: SQLiteDatabase, userId?: string | null): Promise<DashboardTotals> => {
    try {
      const userClause = userId
        ? `AND (i.user_id = '${userId}' OR i.user_id IS NULL OR i.user_id = '')`
        : `AND (i.user_id IS NULL OR i.user_id = '')`;

      const query = `
        SELECT 
          (SELECT COUNT(*) FROM inventarios i WHERE 1=1 ${userClause}) as totalLotes,
          (SELECT COUNT(*) FROM cajas c JOIN inventarios i ON c.inventarioId = i.id WHERE 1=1 ${userClause}) as totalCajas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE 1=1 ${userClause}) as totalPrendas,
          (SELECT COUNT(*) FROM prendas p JOIN cajas c ON p.cajaId = c.id JOIN inventarios i ON c.inventarioId = i.id WHERE p.alarmaFechaHora IS NOT NULL ${userClause}) as totalAlarmas
      `;

      const res = await db.getFirstAsync<DashboardTotals>(query);
      return res || { totalLotes: 0, totalCajas: 0, totalPrendas: 0, totalAlarmas: 0 };
    } catch (e) {
      console.error('Error fetching dashboard totals:', e);
      return { totalLotes: 0, totalCajas: 0, totalPrendas: 0, totalAlarmas: 0 };
    }
  },

  getRecentActivities: async (db: SQLiteDatabase, userId?: string | null): Promise<ActivityItem[]> => {
    try {
      const userClause = userId
        ? `AND (i.user_id = '${userId}' OR i.user_id IS NULL OR i.user_id = '')`
        : `AND (i.user_id IS NULL OR i.user_id = '')`;

      const query = `
        SELECT p.id, p.estilo, p.color, p.op, p.fechaCreacion, c.nombre as cajaNombre
        FROM prendas p
        JOIN cajas c ON p.cajaId = c.id
        JOIN inventarios i ON c.inventarioId = i.id
        WHERE 1=1 ${userClause}
        ORDER BY p.fechaCreacion DESC
        LIMIT 3
      `;

      const rows = await db.getAllAsync<{ id: string; estilo: string; color: string; op?: string; fechaCreacion: string; cajaNombre: string }>(query);

      const items: ActivityItem[] = rows.map(r => ({
        id: r.id,
        type: 'PRENDA',
        icon: 'checkmark-circle-outline',
        title: `Prenda ${r.estilo} (${r.color})`,
        subtitle: `En ${r.cajaNombre} ${r.op ? `• OP: ${r.op}` : ''}`,
        timestamp: r.fechaCreacion,
      }));

      if (items.length === 0) {
        items.push({
          id: 'welcome-1',
          type: 'SYNC',
          icon: 'sync-outline',
          title: 'Sistema listo para operar',
          subtitle: 'Base de datos SQLite sincronizada',
          timestamp: new Date().toISOString(),
        });
      }

      return items;
    } catch (e) {
      console.error('Error fetching recent activities:', e);
      return [];
    }
  }
};
