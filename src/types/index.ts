export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface Inventory {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  order_index?: number;
  orden?: number;
  status: 1 | 0;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_batch_id?: string | null;
  sync_status?: SyncStatus;
}

export interface InventoryStats extends Inventory {
  totalBoxes?: number;
  totalGarments: number;
  scannedGarments?: number;
}

export interface Box {
  id: string;
  inventory_id: string;
  name: string;
  order_index?: number;
  orden?: number;
  status?: 1 | 0;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_batch_id?: string | null;
  sync_status?: SyncStatus;
}

export interface BoxWithStats extends Box {
  itemCount: number;
}

export type StorageLocation = 'LOCAL' | 'CLOUD' | 'BOTH';

export interface GarmentImage {
  id: string;
  garment_id: string;
  uri?: string | null;
  storage_key?: string | null;
  storage: StorageLocation;
  order_index: number;
  is_primary: boolean | number;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_batch_id?: string | null;
  sync_status?: SyncStatus;
}

export type AlarmStatus = 'PENDING' | 'TRIGGERED' | 'EXPIRED' | 'DISMISSED';

export interface GarmentAlarm {
  id: string;
  garment_id: string;
  alarm_datetime: string;
  expires_at?: string | null;
  notification_id?: string | null;
  status: AlarmStatus;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_batch_id?: string | null;
  sync_status?: SyncStatus;
}

export interface Garment {
  id: string;
  box_id: string;
  op: string;
  style: string;
  color: string;
  size?: string;
  shipping_at?: string | null;
  status: 1 | 0;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_batch_id?: string | null;
  sync_status?: SyncStatus;

  photo_uri?: string | null;
  photo_uri_2?: string | null;
  alarm_datetime?: string | null;
  alarm_notification_id?: string | null;
  images?: GarmentImage[];
  alarms?: GarmentAlarm[];

  box_name?: string;
  inventory_name?: string;
}

export type HistoryItem = Garment;

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  Boxes: { inventoryId: string; inventoryName: string; boxCount?: number };
  BoxContents: { boxId: string; boxName: string; targetGarmentId?: string; inventoryName?: string };
  Trash: undefined;
  Form: {
    mode: 'BASIC' | 'NAME_ONLY' | 'ADVANCED';
    entityType: 'inventory' | 'box' | 'garment';
    parentId?: string;
    initialData?: Record<string, any>;
  };
};

export type BottomTabParamList = {
  Home: undefined;
  Inventories: undefined;
  History: undefined;
  Chatbot: undefined;
  Settings: undefined;
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
