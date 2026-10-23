import { getBoxSummary, searchLocal } from '../../src/services/chat/ChatbotService';
import { SearchResult } from '../../src/utils/nlpEngine';

jest.mock('../../src/services/device/SettingsService', () => ({ SettingsService: {} }));
jest.mock('../../src/services/chat/groqClient', () => ({}));
jest.mock('../../src/services/chat/chatRepository', () => ({ ChatRepository: {} }));

const garment = (id: string, style: string, color: string): SearchResult => ({
  id, style, color, op: '310638', box_name: 'Caja 1', box_id: 'caja-1',
  inventory_name: 'Lote A', inventory_id: 'lote-a', status: 1,
});

const items = [
  garment('primera', 'Polo', 'Rojo'),
  garment('segunda', 'Polo', 'Rojo'),
  garment('otra', 'Polo', 'Rosado'),
];

const db = {
  getAllAsync: jest.fn(async () => items),
  getFirstAsync: jest.fn(async (sql: string) => {
    if (sql.includes('FROM garments')) return { total: 3, activas: 3, inactivas: 0 };
    return { total: 1 };
  }),
} as any;

describe('respaldo local del asistente', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca por estilo y color en todas las cajas sin pedir ubicación', async () => {
    const result = await searchLocal(db, 'busca polos rojas');
    expect(result.matches.map(item => item.id)).toEqual(['primera', 'segunda']);
  });

  it('cuenta las coincidencias de una descripción completa', async () => {
    const result = await searchLocal(db, '¿cuántos polos rojos hay?');
    expect(result.text).toContain('Hay 2 prendas');
  });

  it('conserva la respuesta de resumen general', async () => {
    const result = await searchLocal(db, 'resumen del inventario');
    expect(result.text).toContain('Total de prendas: 3');
  });

  it('responde a un saludo sin tratarlo como una prenda', async () => {
    const result = await searchLocal(db, 'Hola');
    expect(result.text).toContain('puedo ayudarte');
    expect(result.matches).toEqual([]);
    expect(db.getAllAsync).not.toHaveBeenCalled();
  });

  it('no confunde el número de la caja 3 con la caja 30', async () => {
    const boxDb = {
      getAllAsync: jest.fn(async () => [
        { id: 'caja-30', name: 'Caja 30', inventory_id: 'lote-a', inventory_name: 'Lote A' },
      ]),
    } as any;
    const result = await getBoxSummary(boxDb, '3');
    expect(result.found).toBe(false);
  });

  it('mantiene el total real de una caja aunque dibuje pocas tarjetas', async () => {
    const boxDb = {
      getAllAsync: jest.fn(async (sql: string) => sql.includes('FROM boxes b')
        ? [{ id: 'caja-1', name: 'Caja 1', inventory_id: 'lote-a', inventory_name: 'Lote A' }]
        : Array.from({ length: 20 }, (_, index) => garment(String(index), 'Polo', 'Rojo'))),
      getFirstAsync: jest.fn(async () => ({ total: 35, activas: 30, inactivas: 5 })),
    } as any;

    const result = await getBoxSummary(boxDb, '1');
    expect(result.boxMatch?.total_garments).toBe(35);
    expect(result.matches).toHaveLength(20);
    expect(result.text).toContain('Mostrando las primeras 20');
  });
});
