import { rankGarmentCandidates } from '../../src/services/chat/garmentSearch';
import { SearchResult } from '../../src/utils/nlpEngine';

const garment = (id: string, style: string, color: string, op: string, box = 'Caja 1'): SearchResult => ({
  id, style, color, op, box_name: box, box_id: box, inventory_name: 'Lote A',
  inventory_id: 'lote-a', status: 1,
});

describe('búsqueda de prendas del asistente', () => {
  it('encuentra todas las prendas iguales sin pedir caja y excluye colores parecidos', () => {
    const items = [
      garment('a', 'Polo', 'Rojo', '310638', 'Caja 1'),
      garment('b', 'Polo', 'Rojo', '310638', 'Caja 2'),
      garment('c', 'Polo', 'Rosado', '310639', 'Caja 1'),
      garment('d', 'Polo', 'Azul', '310640', 'Caja 3'),
    ];

    expect(rankGarmentCandidates(items, 'busca polos rojas').map(item => item.id)).toEqual(['a', 'b']);
  });

  it('prioriza una OP completa y no confunde un prefijo con otra OP', () => {
    const items = [
      garment('correcta', 'KHBG 200 004', 'Nocturnal', '310638'),
      garment('otra-op', 'KHBG 200 004', 'Nocturnal', '3106389'),
      garment('codigo-estilo', '310638', 'Nocturnal', '999999'),
    ];

    expect(rankGarmentCandidates(items, 'busca OP 310638').map(item => item.id)).toEqual(['correcta']);
  });

  it('encuentra un código de estilo escrito por partes y mantiene los duplicados', () => {
    const items = [
      garment('uno', 'KHBG-200-004', 'Negro', '111111'),
      garment('dos', 'KHBG-200-004', 'Negro', '111111'),
      garment('parecido', 'KHBG-200-005', 'Negro', '111112'),
    ];

    expect(rankGarmentCandidates(items, 'estilo KHBG 200 004').map(item => item.id)).toEqual(['uno', 'dos']);
  });

  it('respeta la caja cuando se menciona y evita coincidencias solo por ubicación', () => {
    const items = [
      garment('correcta', 'Polo', 'Azul', '111111', 'Caja 3'),
      garment('otra-caja', 'Polo', 'Azul', '111112', 'Caja 2'),
      garment('otro-estilo', 'Casaca', 'Azul', '111113', 'Caja 3'),
    ];

    expect(rankGarmentCandidates(items, 'busca polo azul en caja 3').map(item => item.id)).toEqual(['correcta']);
    expect(rankGarmentCandidates(items, 'busca polo verde')).toEqual([]);
  });
});
