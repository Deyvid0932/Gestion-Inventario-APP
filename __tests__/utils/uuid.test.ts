import { generateUUID } from '../../src/utils/uuid';

describe('uuid', () => {
  test('debe generar un UUID v4 válido con el formato de 36 caracteres', () => {
    const uuid = generateUUID();
    expect(uuid).toHaveLength(36);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  test('debe generar UUIDs únicos secuenciales', () => {
    const set = new Set();
    for (let i = 0; i < 100; i++) {
      set.add(generateUUID());
    }
    expect(set.size).toBe(100);
  });
});
