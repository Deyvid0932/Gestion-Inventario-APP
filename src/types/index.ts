export interface Inventario {
  id: string;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
  estado: 'Activo' | 'Inactivo';
}

export interface Caja {
  id: string;
  inventarioId: string;
  nombre: string;
  fechaCreacion: string;
}

export interface Prenda {
  id: string;
  cajaId: string;
  op: string;
  estilo: string;
  color: string;
  estado: 1 | 0 ; // 1 para Activo, 0 para Inactivo
}

export interface DetallePrenda {
  id: string;
  op: string;
  estilo: string;
  color: string;
  estado: 1 | 0 ; // 1 para Activo, 0 para Inactivo
}

export type RootStackParamList = {
  MainTabs: undefined;
  Cajas: { inventarioId: string; nombreInventario: string };
  ExcelGrid: { cajaId: string;   nombreCaja: string };
  GarmentDetails: { cajaId: string; nombreCaja: string };
  Form: { 
    mode: 'BASIC' | 'NAME_ONLY' | 'ADVANCED' | 'ADVANCED_LITE';
    entityType: 'inventario' | 'caja' | 'prenda' | 'detalle_prenda';
    parentId?: string; // inventarioId for cajas, cajaId for prendas
    initialData?: Record<string, any>;
  };
};

export type BottomTabParamList = {
  Inventarios: undefined;
  History: undefined;
  GarmentDetails: { cajaId: string; nombreCaja: string };
};
