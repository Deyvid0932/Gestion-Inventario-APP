import { SQLiteDatabase } from 'expo-sqlite';
import { ColorSchemeType } from '../style/theme';

export const SettingsService = {
  getSetting: async (db: SQLiteDatabase, key: string, defaultValue: string): Promise<string> => {
    try {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        [key]
      );
      return row ? row.value : defaultValue;
    } catch (e) {
      console.error(`Error al leer ajuste ${key}:`, e);
      return defaultValue;
    }
  },

  saveSetting: async (db: SQLiteDatabase, key: string, value: string): Promise<void> => {
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    } catch (e) {
      console.error(`Error al guardar ajuste ${key}:`, e);
    }
  },

  loadThemeSettings: async (db: SQLiteDatabase): Promise<{ themeMode: 'light' | 'dark'; colorScheme: ColorSchemeType }> => {
    const themeMode = (await SettingsService.getSetting(db, 'themeMode', 'light')) as 'light' | 'dark';
    const colorScheme = (await SettingsService.getSetting(db, 'colorScheme', 'morado')) as ColorSchemeType;
    return { themeMode, colorScheme };
  }
};
