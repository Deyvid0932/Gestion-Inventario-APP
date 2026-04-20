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
  updatePrendaInState: (id: string, updates: Partial<Prenda>) => void;
  
  addDetallePrendaToState: (detalle: DetallePrenda) => void;
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

  updatePrendaInState: (id, updates) => set((state) => ({
    prendas: state.prendas.map(p => p.id === id ? { ...p, ...updates } : p)
  })),

  addDetallePrendaToState: (detalle) => set((state) => ({ 
    detallesPrenda: [detalle, ...state.detallesPrenda] 
  })),

  updateDetallePrendaInState: (id, updates) => set((state) => ({
    detallesPrenda: state.detallesPrenda.map(d => d.id === id ? { ...d, ...updates } : d)
  })),

  removeDetallesPrendaFromState: (ids) => set((state) => ({
    detallesPrenda: state.detallesPrenda.filter(d => !ids.includes(d.id)),
    selectedPrendas: state.selectedPrendas.filter(id => !ids.includes(id))
  })),

  toggleSelectPrenda: (id) => set((state) => ({
    selectedPrendas: state.selectedPrendas.includes(id)
      ? state.selectedPrendas.filter(sid => sid !== id)
      : [...state.selectedPrendas, id]
  })),

  clearSelectedPrendas: () => set({ selectedPrendas: [] }),
  selectAllPrendas: (ids) => set({ selectedPrendas: ids }),
  clearSelectedDetallesPrenda: () => set({ selectedPrendas: [] }),
}));
