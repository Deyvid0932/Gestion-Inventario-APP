import { rankResults, SearchResult } from '../../src/utils/nlpEngine';

const garment = (id: string): SearchResult => ({
  id,
  op: '310638',
  style: 'KHBG 200 004',
  color: 'NOCTURNAL',
  status: 1,
  box_id: 'box-1',
  box_name: 'CAJA 01',
  inventory_id: 'inventory-1',
  inventory_name: 'TOPYTOP',
});

describe('rankResults', () => {
  it('conserva prendas distintas aunque sus datos visibles sean idénticos', () => {
    const results = rankResults(
      [garment('garment-1'), garment('garment-2')],
      ['khbg', '200', '004'],
      'buscar estilo KHBG 200 004',
    );

    expect(results.map(item => item.id)).toEqual(['garment-1', 'garment-2']);
  });
});
