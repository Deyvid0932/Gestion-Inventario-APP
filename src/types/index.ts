export interface Inventario {
  id: string;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
  estado: 'Activo' | 'Inactivo';
}

export interface InventarioStats extends Inventario {
  totalPrendas: number;
  prendasEscaneadas: number;
}

export interface Caja {
  id: string;
  inventarioId: string;
  nombre: string;
  fechaCreacion: string;
  orden?: number;
}

export interface CajaWithStats extends Caja {
  itemCount: number;
}

export interface Prenda {
  id: string;
  cajaId: string;
  op: string;
  estilo: string;
  color: string;
  estado: 1 | 0 ; 
  fotoUri?: string | null;
  fechaCreacion?: string;
}

export interface HistoryItem extends Prenda {
  cajaNombre: string;
  inventarioNombre: string;
}

export type RootStackParamList = {
  MainTabs: undefined;
  Cajas: { inventarioId: string; nombreInventario: string };
  ExcelGrid: { cajaId: string;   nombreCaja: string, targetPrendaId?: string };
  Form: { 
    mode: 'BASIC' | 'NAME_ONLY' | 'ADVANCED';
    entityType: 'inventario' | 'caja' | 'prenda';
    parentId?: string; // inventarioId for cajas, cajaId for prendas
    initialData?: Record<string, any>;
  };
};

export type BottomTabParamList = {
  Inventarios: undefined;
  History: undefined;
  GarmentDetails: { cajaId: string; nombreCaja: string };
};
