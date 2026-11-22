import { SQLiteDatabase } from 'expo-sqlite';

export interface BoxTopData {
  name: string;
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
  totalInventories: number;
  totalBoxes: number;
  totalGarments: number;
  activeGarments: number;
  inactiveGarments: number;
  garmentsWithPhoto: number;
  garmentsWithAlarm: number;
  topBoxName: string;
  topBoxCount: number;
  top5Boxes: BoxTopData[];
  topColors: ColorBreakdownData[];
  weeklyTrend?: DailyTrendData[];
}

export const StatsService = {
  getStats: async (db: SQLiteDatabase, _userId?: string | null): Promise<DashboardStats> => {
    try {
      const stats: DashboardStats = {
        totalInventories: 0,
        totalBoxes: 0,
        totalGarments: 0,
        activeGarments: 0,
        inactiveGarments: 0,
        garmentsWithPhoto: 0,
        garmentsWithAlarm: 0,
        topBoxName: 'Ninguna',
        topBoxCount: 0,
        top5Boxes: [],
        topColors: [],
        weeklyTrend: [],
      };

      const userFilter = '1=1';

      const [invBoxCounts, garmentAgg] = await Promise.all([
        db.getFirstAsync<{ totalInventories: number; totalBoxes: number }>(`
          SELECT
            (SELECT COUNT(*) FROM inventories i WHERE ${userFilter} AND i.deleted_at IS NULL) as totalInventories,
            (SELECT COUNT(*) FROM boxes b JOIN inventories i ON b.inventory_id = i.id WHERE ${userFilter} AND b.deleted_at IS NULL AND i.deleted_at IS NULL) as totalBoxes
        `),
        db.getFirstAsync<{
          totalGarments: number;
          activeGarments: number;
          inactiveGarments: number;
          garmentsWithPhoto: number;
          garmentsWithAlarm: number;
        }>(`
          SELECT
            COUNT(*) as totalGarments,
            COALESCE(SUM(CASE WHEN g.status = 1 THEN 1 ELSE 0 END), 0) as activeGarments,
            COALESCE(SUM(CASE WHEN g.status = 0 THEN 1 ELSE 0 END), 0) as inactiveGarments,
            COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM garment_images gi WHERE gi.garment_id = g.id AND gi.deleted_at IS NULL AND ((gi.uri IS NOT NULL AND gi.uri != '') OR (gi.storage_key IS NOT NULL AND gi.storage_key != ''))) THEN 1 ELSE 0 END), 0) as garmentsWithPhoto,
            COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM garment_alarms ga WHERE ga.garment_id = g.id AND ga.deleted_at IS NULL AND ga.alarm_datetime IS NOT NULL AND ga.alarm_datetime != '') THEN 1 ELSE 0 END), 0) as garmentsWithAlarm
          FROM garments g
          JOIN boxes b ON g.box_id = b.id
          JOIN inventories i ON b.inventory_id = i.id
          WHERE ${userFilter} AND g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
        `),
      ]);

      if (invBoxCounts) {
        stats.totalInventories = invBoxCounts.totalInventories;
        stats.totalBoxes = invBoxCounts.totalBoxes;
      }
      if (garmentAgg) {
        stats.totalGarments = garmentAgg.totalGarments;
        stats.activeGarments = garmentAgg.activeGarments;
        stats.inactiveGarments = garmentAgg.inactiveGarments;
        stats.garmentsWithPhoto = garmentAgg.garmentsWithPhoto;
        stats.garmentsWithAlarm = garmentAgg.garmentsWithAlarm;
      }

      const topResult = await db.getAllAsync<{ name: string; total: number }>(`
        SELECT b.name as name, COUNT(*) as total 
        FROM garments g 
        JOIN boxes b ON g.box_id = b.id 
        JOIN inventories i ON b.inventory_id = i.id
        WHERE ${userFilter} AND g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
        GROUP BY g.box_id 
        ORDER BY total DESC 
        LIMIT 5
      `);

      if (topResult && topResult.length > 0) {
        stats.topBoxName = topResult[0].name;
        stats.topBoxCount = topResult[0].total;
        stats.top5Boxes = topResult;
      }

      const colorResult = await db.getAllAsync<{ color: string; count: number }>(`
        SELECT g.color, COUNT(*) as count 
        FROM garments g 
        JOIN boxes b ON g.box_id = b.id 
        JOIN inventories i ON b.inventory_id = i.id
        WHERE ${userFilter} AND g.color IS NOT NULL AND g.color != '' AND g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
        GROUP BY g.color 
        ORDER BY count DESC 
        LIMIT 5
      `);

      if (colorResult) {
        stats.topColors = colorResult;
      }

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

      const recentGarments = await db.getAllAsync<{ created_at: string }>(
        `SELECT created_at FROM garments WHERE deleted_at IS NULL AND created_at >= ?`,
        [sevenDaysAgoISO]
      );

      if (recentGarments && recentGarments.length > 0) {
        recentGarments.forEach(g => {
          if (!g.created_at) return;
          const pDate = new Date(g.created_at);
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
        totalInventories: 0,
        totalBoxes: 0,
        totalGarments: 0,
        activeGarments: 0,
        inactiveGarments: 0,
        garmentsWithPhoto: 0,
        garmentsWithAlarm: 0,
        topBoxName: 'Ninguna',
        topBoxCount: 0,
        top5Boxes: [],
        topColors: [],
        weeklyTrend: [],
      };
    }
  }
};
