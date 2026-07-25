import { SQLiteDatabase } from 'expo-sqlite';

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  errors?: string[];
}

export interface SyncAdapter {
  tableName: string;
  pushLocal(db: SQLiteDatabase, userId: string): Promise<SyncResult>;
  pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult>;
  cleanForUser(db: SQLiteDatabase): Promise<void>;
  adoptForUser(db: SQLiteDatabase, userId: string): Promise<void>;
}
