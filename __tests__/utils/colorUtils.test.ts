import { getColorHex, colorMap } from '../../src/utils/colorUtils';

describe('colorUtils', () => {
  test('debe retornar el color Hex exacto para un nombre en español o inglés', () => {
    expect(getColorHex('rojo')).toBe('#FF3B30');
    expect(getColorHex('blue')).toBe('#007AFF');
    expect(getColorHex('verde')).toBe('#34C759');
    expect(getColorHex('negro')).toBe('#1C1C1E');
  });

  test('debe ignorar mayúsculas y espacios en blanco al inicio o final', () => {
    expect(getColorHex('  ROJO ')).toBe('#FF3B30');
    expect(getColorHex('BLUE  ')).toBe('#007AFF');
  });

  test('debe resolver colores compuestos o con sufijos', () => {
    expect(getColorHex('azul marino')).toBe('#007AFF');
    expect(getColorHex('bright white')).toBe('#F9F9F9');
  });

  test('debe retornar gris por defecto (#8E8E93) si el color es undefined, null o vacío', () => {
    expect(getColorHex(undefined)).toBe('#8E8E93');
    expect(getColorHex(null)).toBe('#8E8E93');
    expect(getColorHex('')).toBe('#8E8E93');
  });

  test('debe retornar gris por defecto para un color desconocido', () => {
    expect(getColorHex('color_ficticio_xyz')).toBe('#8E8E93');
  });
});
