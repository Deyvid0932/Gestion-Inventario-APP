import { create } from 'zustand';
import { SQLiteDatabase } from 'expo-sqlite';
import { User, Session } from '@supabase/supabase-js';
import { getTheme, ColorSchemeType, theme } from '../style/theme';
import { Prenda } from '../types';
import { SettingsService } from '../services/SettingsService';

interface AppState {
  themeMode: 'light' | 'dark';
  colorScheme: ColorSchemeType;
  currentTheme: typeof theme.light;
  loadThemeFromDb: (db: SQLiteDatabase) => Promise<void>;
  toggleTheme: (db?: SQLiteDatabase) => void;
  setColorScheme: (scheme: ColorSchemeType, db?: SQLiteDatabase) => void;

  // Supabase Auth & Sync State
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  lastSyncTime: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsAuthLoading: (loading: boolean) => void;
  setLastSyncTime: (time: string | null) => void;
  logout: () => void;

  prendas: Prenda[];
  selectedPrendas: Record<string, boolean>;
  
  setPrendas: (prendas: Prenda[]) => void;
  addPrendaToState: (prenda: Prenda) => void;
  updatePrendaInState: (id: string, updates: Partial<Prenda>) => void;
  toggleSelectPrenda: (id: string) => void;
  clearSelectedPrendas: () => void;
  selectAllPrendas: (ids: string[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: 'light',
  colorScheme: 'morado',
  currentTheme: getTheme('morado', 'light'),

  loadThemeFromDb: async (db: SQLiteDatabase) => {
    try {
      const settings = await SettingsService.loadThemeSettings(db);
      set({
        themeMode: settings.themeMode,
        colorScheme: settings.colorScheme,
        currentTheme: getTheme(settings.colorScheme, settings.themeMode)
      });
    } catch (e) {
      console.error('Error cargando tema desde SQLite:', e);
    }
  },
  
  toggleTheme: (db?: SQLiteDatabase) => set((state) => {
    const newMode = state.themeMode === 'light' ? 'dark' : 'light';
    if (db) {
      SettingsService.saveSetting(db, 'themeMode', newMode);
    }
    return {
      themeMode: newMode,
      currentTheme: getTheme(state.colorScheme, newMode)
    };
  }),

  setColorScheme: (scheme, db?: SQLiteDatabase) => set((state) => {
    if (db) {
      SettingsService.saveSetting(db, 'colorScheme', scheme);
    }
    return {
      colorScheme: scheme,
      currentTheme: getTheme(scheme, state.themeMode)
    };
  }),

  // Auth State
  user: null,
  session: null,
  isAuthLoading: false,
  lastSyncTime: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  logout: () => set({ user: null, session: null }),

  prendas: [],
  selectedPrendas: {},
  setPrendas: (prendas) => set({ prendas }),
  addPrendaToState: (prenda) => set((state) => ({ 
    prendas: [prenda, ...state.prendas] 
  })),

  updatePrendaInState: (id, updates) => set((state) => {
    const index = state.prendas.findIndex(p => p.id === id);
    if (index === -1) return state;
    const newPrendas = [...state.prendas];
    newPrendas[index] = { ...newPrendas[index], ...updates };
    return { prendas: newPrendas };
  }),

  toggleSelectPrenda: (id) => set((state) => {
    const isSelected = !!state.selectedPrendas[id];
    return {
      selectedPrendas: {
        ...state.selectedPrendas,
        [id]: !isSelected
      }
    };
  }),

  clearSelectedPrendas: () => set({ selectedPrendas: {} }),
  selectAllPrendas: (ids) => {
    const record: Record<string, boolean> = {};
    ids.forEach(id => record[id] = true);
    set({ selectedPrendas: record });
  },
}));
