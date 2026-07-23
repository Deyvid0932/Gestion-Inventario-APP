import { create } from 'zustand';
import { getTheme, ColorSchemeType, theme } from '../style/theme';
import { Prenda } from '../types';

interface AppState {
  themeMode: 'light' | 'dark';
  colorScheme: ColorSchemeType;
  currentTheme: typeof theme.light;
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorSchemeType) => void;

  prendas: Prenda[];
  selectedPrendas: string[];
  
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
  
  toggleTheme: () => set((state) => {
    const newMode = state.themeMode === 'light' ? 'dark' : 'light';
    return {
      themeMode: newMode,
      currentTheme: getTheme(state.colorScheme, newMode)
    };
  }),

  setColorScheme: (scheme) => set((state) => ({
    colorScheme: scheme,
    currentTheme: getTheme(scheme, state.themeMode)
  })),

  prendas: [],
  selectedPrendas: [],
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
    const isSelected = state.selectedPrendas.includes(id);
    return {
      selectedPrendas: isSelected
        ? state.selectedPrendas.filter(sid => sid !== id)
        : [...state.selectedPrendas, id]
    };
  }),

  clearSelectedPrendas: () => set({ selectedPrendas: [] }),
  selectAllPrendas: (ids) => set({ selectedPrendas: ids }),
}));
