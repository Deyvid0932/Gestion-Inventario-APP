import { askGroqToClassify } from '../../src/services/chat/groqClient';
import { SettingsService } from '../../src/services/device/SettingsService';

jest.mock('../../src/services/device/SettingsService', () => ({
  SettingsService: { getSetting: jest.fn(async () => 'test-key') },
}));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('clasificación del asistente', () => {
  it('usa directamente el modelo rápido sin pedir antes la lista de modelos', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        tipo: 'DATOS_INVENTARIO', respuestaDirecta: null,
        consulta: { accion: 'BUSQUEDA_PUNTUAL', estilo: 'Polo', color: 'Rojo' },
      }) } }] }),
    })) as any;

    const result = await askGroqToClassify({} as any, 'busca polo rojo', []);
    expect(result?.modelName).toBe('openai/gpt-oss-20b');
    expect(SettingsService.getSetting).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/chat/completions');
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.model).toBe('openai/gpt-oss-20b');
    expect(requestBody.reasoning_effort).toBe('low');
  });

  it('termina la espera si la red no responde', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as any;

    const pending = askGroqToClassify({} as any, 'busca casaca gris 98765', []);
    await jest.advanceTimersByTimeAsync(5_000);

    expect(await pending).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
