import { SQLiteDatabase } from 'expo-sqlite';
import { SynchronizationEngine } from '../../sync/SynchronizationEngine';

export const SyncService = {
  getLastSyncTime: async (): Promise<string | null> => {
    return await SynchronizationEngine.getLastSyncTime();
  },

  setLastSyncTime: async (timestamp?: string): Promise<string> => {
    return await SynchronizationEngine.setLastSyncTime(timestamp);
  },

  syncInventories: async (db: SQLiteDatabase, userId: string): Promise<boolean> => {
    const res = await SynchronizationEngine.fullSync(db, userId);
    return res.success;
  },

  syncBoxes: async (db: SQLiteDatabase, userId: string): Promise<boolean> => {
    const res = await SynchronizationEngine.fullSync(db, userId);
    return res.success;
  },

  syncGarments: async (db: SQLiteDatabase, userId: string): Promise<boolean> => {
    const res = await SynchronizationEngine.fullSync(db, userId);
    return res.success;
  },

  syncHistory: async (_db: SQLiteDatabase, _userId: string): Promise<boolean> => {
    return true;
  },

  syncSettings: async (_db: SQLiteDatabase, _userId: string): Promise<boolean> => {
    return true;
  },

  syncAll: async (db: SQLiteDatabase, userId: string): Promise<{ success: boolean; syncedAt: string }> => {
    return await SynchronizationEngine.fullSync(db, userId);
  },
};
