import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { User, Session } from '@supabase/supabase-js';
import { getTheme, ColorSchemeType, theme } from '../style/theme';
import { Prenda, InventarioStats } from '../types';
import { SettingsService } from '../services/SettingsService';

const ONBOARDING_KEY = 'has_completed_onboarding_v1';

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
  isSyncing: boolean;
  syncMessage: string;
  lastSyncTime: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsAuthLoading: (loading: boolean) => void;
  setSyncing: (isSyncing: boolean, message?: string) => void;
  setLastSyncTime: (time: string | null) => void;
  logout: () => void;

  // Onboarding State
  hasCompletedOnboarding: boolean | null;
  checkOnboardingStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;

  // Estado Reactivo de Datos
  inventarios: InventarioStats[];
  prendas: Prenda[];
  selectedPrendas: Record<string, boolean>;
  
  setInventarios: (inventarios: InventarioStats[]) => void;
  setPrendas: (prendas: Prenda[]) => void;
  addPrendaToState: (prenda: Prenda) => void;
  updatePrendaInState: (id: string, updates: Partial<Prenda>) => void;
  toggleSelectPrenda: (id: string) => void;
  clearSelectedPrendas: () => void;
  selectAllPrendas: (ids: string[]) => void;
  clearAllState: () => void;
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
  isSyncing: false,
  syncMessage: '',
  lastSyncTime: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  setSyncing: (isSyncing, message) => set({ isSyncing, syncMessage: message || '' }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  logout: () => set({ user: null, session: null, isSyncing: false }),

  // Onboarding State
  hasCompletedOnboarding: null,
  checkOnboardingStatus: async () => {
    try {
      const val = await AsyncStorage.getItem(ONBOARDING_KEY);
      set({ hasCompletedOnboarding: val === 'true' });
    } catch {
      set({ hasCompletedOnboarding: false });
    }
  },
  completeOnboarding: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ hasCompletedOnboarding: true });
    } catch (e) {
      console.error('Error guardando estado de onboarding:', e);
      set({ hasCompletedOnboarding: true });
    }
  },

  // Reactivity State
  inventarios: [],
  prendas: [],
  selectedPrendas: {},
  setInventarios: (inventarios) => set({ inventarios }),
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

  // Reset instantáneo de UI al cerrar sesión
  clearAllState: () => set({
    user: null,
    session: null,
    lastSyncTime: null,
    isSyncing: false,
    syncMessage: '',
    inventarios: [],
    prendas: [],
    selectedPrendas: {}
  })
}));
