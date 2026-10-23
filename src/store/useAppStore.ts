import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { User, Session } from '@supabase/supabase-js';
import { getTheme, ColorSchemeType, theme } from '../styles/theme';
import { Garment, InventoryStats } from '../types';
import { SettingsService } from '../services/device/SettingsService';
import { UserProfile, RoleName } from '../types/roles';

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
  userProfile: UserProfile | null;
  userRoles: RoleName[];
  isAccountActive: boolean;
  isRoleLoading: boolean;
  isAuthLoading: boolean;
  isSyncing: boolean;
  syncMessage: string;
  lastSyncTime: string | null;
  dataRevision: number;
  isOnline: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setUserProfileAndRoles: (profile: UserProfile | null, roles: RoleName[], isActive?: boolean) => void;
  setIsRoleLoading: (loading: boolean) => void;
  setIsAuthLoading: (loading: boolean) => void;
  setSyncing: (isSyncing: boolean, message?: string) => void;
  setLastSyncTime: (time: string | null) => void;
  bumpDataRevision: () => void;
  setIsOnline: (isOnline: boolean) => void;
  logout: () => void;

  // Onboarding State
  hasCompletedOnboarding: boolean | null;
  checkOnboardingStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;

  // Data State (Pure English standard)
  inventories: InventoryStats[];
  garments: Garment[];
  selectedGarments: Record<string, boolean>;
  exportSelectionDraft: {
    fileName: string;
    selectedColumns: { op: boolean; style: boolean; color: boolean; location: boolean; status: boolean };
    separateBySheet: boolean;
    formatVersion?: number;
  } | null;
  
  setInventories: (inventories: InventoryStats[]) => void;
  setGarments: (garments: Garment[]) => void;
  addGarmentToState: (garment: Garment) => void;
  updateGarmentInState: (id: string, updates: Partial<Garment>) => void;
  toggleSelectGarment: (id: string) => void;
  clearSelectedGarments: () => void;
  setExportSelectionDraft: (draft: AppState['exportSelectionDraft']) => void;
  selectAllGarments: (ids: string[]) => void;
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
      console.error('Error loading theme from SQLite:', e);
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
  userProfile: null,
  userRoles: [],
  isAccountActive: true,
  isRoleLoading: false,
  isAuthLoading: false,
  isSyncing: false,
  syncMessage: '',
  lastSyncTime: null,
  dataRevision: 0,
  isOnline: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setUserProfileAndRoles: (userProfile, userRoles, isAccountActive = true) => set({
    userProfile,
    userRoles,
    isAccountActive,
    isRoleLoading: false,
  }),
  setIsRoleLoading: (isRoleLoading) => set({ isRoleLoading }),
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  setSyncing: (isSyncing, message) => set({ isSyncing, syncMessage: message || '' }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  bumpDataRevision: () => set((state) => ({ dataRevision: state.dataRevision + 1 })),
  setIsOnline: (isOnline) => set({ isOnline }),
  logout: () => set({
    user: null,
    session: null,
    userProfile: null,
    userRoles: [],
    isAccountActive: true,
    isSyncing: false
  }),

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
      console.error('Error saving onboarding state:', e);
      set({ hasCompletedOnboarding: true });
    }
  },

  // Reactivity State
  inventories: [],
  garments: [],
  selectedGarments: {},
  exportSelectionDraft: null,

  setInventories: (inventories) => set({ inventories }),

  setGarments: (garments) => set({ garments }),

  addGarmentToState: (garment) => set((state) => ({ 
    garments: [garment, ...state.garments],
  })),

  updateGarmentInState: (id, updates) => set((state) => {
    const index = state.garments.findIndex(g => g.id === id);
    if (index === -1) return state;
    const newGarments = [...state.garments];
    newGarments[index] = { ...newGarments[index], ...updates };
    return { garments: newGarments };
  }),

  toggleSelectGarment: (id) => set((state) => {
    const isSelected = !!state.selectedGarments[id];
    return { selectedGarments: { ...state.selectedGarments, [id]: !isSelected } };
  }),

  clearSelectedGarments: () => set({ selectedGarments: {} }),
  setExportSelectionDraft: (exportSelectionDraft) => set({ exportSelectionDraft }),

  selectAllGarments: (ids) => {
    const record: Record<string, boolean> = {};
    ids.forEach(id => record[id] = true);
    set({ selectedGarments: record });
  },

  clearAllState: () => set((state) => ({
    user: null,
    session: null,
    userProfile: null,
    userRoles: [],
    isAccountActive: true,
    isRoleLoading: false,
    lastSyncTime: null,
    isSyncing: false,
    syncMessage: '',
    inventories: [],
    garments: [],
    selectedGarments: {},
    exportSelectionDraft: null,
    dataRevision: state.dataRevision + 1,
  }))
}));
