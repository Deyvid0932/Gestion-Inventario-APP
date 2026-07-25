export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface Inventario {
  id: string;
  user_id?: string | null;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
  estado: 'Activo' | 'Inactivo';
  updated_at?: string;
  deleted_at?: string | null;
  sync_status?: SyncStatus;
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
  updated_at?: string;
  deleted_at?: string | null;
  sync_status?: SyncStatus;
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
  estado: 1 | 0;
  fotoUri?: string | null;
  fotoUri2?: string | null;
  fechaCreacion?: string;
  alarmaFechaHora?: string | null;
  alarmaNotificationId?: string | null;
  updated_at?: string;
  deleted_at?: string | null;
  sync_status?: SyncStatus;
}

export interface HistoryItem extends Prenda {
  cajaNombre: string;
  inventarioNombre: string;
}

export type RootStackParamList = {
  MainTabs: undefined;
  Cajas: { inventarioId: string; nombreInventario: string };
  ExcelGrid: { cajaId: string; nombreCaja: string; targetPrendaId?: string };
  Form: {
    mode: 'BASIC' | 'NAME_ONLY' | 'ADVANCED';
    entityType: 'inventario' | 'caja' | 'prenda';
    parentId?: string;
    initialData?: Record<string, any>;
  };
};

export type BottomTabParamList = {
  Inventarios: undefined;
  Stats: undefined;
  Chatbot: undefined;
  History: undefined;
  GarmentDetails: { cajaId: string; nombreCaja: string };
};

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}
