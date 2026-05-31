import { create } from 'zustand';
import { theme } from '../style/theme';
import { DetallePrenda, Prenda } from '../types';

interface AppState {
  themeMode: 'light' | 'dark';
  currentTheme: typeof theme.light;
  toggleTheme: () => void;

  prendas: Prenda[];
  detallesPrenda: DetallePrenda[]; 
  selectedPrendas: string[];
  
  setPrendas: (prendas: Prenda[]) => void;
  setDetallesPrenda: (detalles: DetallePrenda[]) => void;
  
  addPrendaToState: (prenda: Prenda) => void;
  addDetallePrendaToState: (detalle: DetallePrenda) => void;

  updatePrendaInState: (id: string, updates: Partial<Prenda>) => void;
  updateDetallePrendaInState: (id: string, updates: Partial<DetallePrenda>) => void;
  
  removeDetallesPrendaFromState: (ids: string[]) => void;

  toggleSelectPrenda: (id: string) => void;
  clearSelectedPrendas: () => void;
  selectAllPrendas: (ids: string[]) => void;
  clearSelectedDetallesPrenda: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: 'light',
  currentTheme: theme.light,
  
  toggleTheme: () => set((state) => {
    const newMode = state.themeMode === 'light' ? 'dark' : 'light';
    return {
      themeMode: newMode,
      currentTheme: theme[newMode]
    };
  }),

  prendas: [],
  detallesPrenda: [],
  selectedPrendas: [],

  setPrendas: (prendas) => set({ prendas }),
  setDetallesPrenda: (detallesPrenda) => set({ detallesPrenda }),

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

  addDetallePrendaToState: (detalle) => set((state) => ({ 
    detallesPrenda: [detalle, ...state.detallesPrenda] 
  })),

  updateDetallePrendaInState: (id, updates) => set((state) => {
    const index = state.detallesPrenda.findIndex(d => d.id === id);
    if (index === -1) return state;
    const newDetalles = [...state.detallesPrenda];
    newDetalles[index] = { ...newDetalles[index], ...updates };
    return { detallesPrenda: newDetalles };
  }),

  removeDetallesPrendaFromState: (ids) => set((state) => {
    const idSet = new Set(ids);
    return {
      detallesPrenda: state.detallesPrenda.filter(d => !idSet.has(d.id)),
      selectedPrendas: state.selectedPrendas.filter(id => !idSet.has(id))
    };
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
  clearSelectedDetallesPrenda: () => set({ selectedPrendas: [] }),
}));

