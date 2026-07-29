export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface Inventario {
  id: string;
  user_id?: string | null;
  name?: string;
  nombre: string;
  description?: string;
  descripcion: string;
  created_at?: string;
  fechaCreacion: string;
  status?: 1 | 0;
  estado: 'Activo' | 'Inactivo' | number;
  updated_at?: string;
  deleted_at?: string | null;
  sync_status?: SyncStatus;
}

export interface InventarioStats extends Inventario {
  totalCajas?: number;
  totalPrendas: number;
  prendasEscaneadas: number;
}

export interface Caja {
  id: string;
  inventory_id?: string;
  inventarioId: string;
  name?: string;
  nombre: string;
  created_at?: string;
  fechaCreacion: string;
  order_index?: number;
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
  box_id?: string;
  cajaId: string;
  op: string;
  style?: string;
  estilo: string;
  color: string;
  talla?: string;
  status?: 1 | 0;
  estado: 1 | 0;
  fotoUri?: string | null;
  fotoUri2?: string | null;
  r2_key?: string | null;
  r2Key?: string | null;
  r2_key_2?: string | null;
  r2Key2?: string | null;
  created_at?: string;
  fechaCreacion?: string;
  alarm_datetime?: string | null;
  alarmaFechaHora?: string | null;
  alarm_notification_id?: string | null;
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
  Onboarding: undefined;
  MainTabs: undefined;
  Cajas: { inventarioId: string; nombreInventario: string };
  ExcelGrid: { cajaId: string; nombreCaja: string; targetPrendaId?: string };
  Trash: undefined;
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
  user_id?: string | null;
  title: string;
  created_at?: number | string;
  createdAt: number;
  updated_at?: number | string;
  updatedAt: number;
}

export * from './roles';
