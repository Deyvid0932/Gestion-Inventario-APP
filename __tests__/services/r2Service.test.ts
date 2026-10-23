import { R2Service } from '../../src/services/cloud/r2Service';
import { supabase } from '../../src/database/supabase';

jest.mock('../../src/database/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documentDirectory/',
  readAsStringAsync: jest.fn().mockResolvedValue('base64StringMockData'),
  getInfoAsync: jest.fn().mockImplementation(async (path: string) => {
    if (path.includes('/data/user/photo.jpg')) {
      return { exists: true };
    }
    return { exists: false };
  }),
  downloadAsync: jest.fn().mockResolvedValue({ status: 200 }),
}));

describe('R2Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSignedUrlFromR2', () => {
    test('debe retornar null si la clave r2Key es nula o vacía', async () => {
      const url = await R2Service.getSignedUrlFromR2('');
      expect(url).toBeNull();
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    test('debe obtener la URL firmada correctamente de la Edge Function', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { signedUrl: 'https://r2.cloudflarestorage.com/signed-url-test' },
        error: null,
      });

      const url = await R2Service.getSignedUrlFromR2('prendas/user1/prenda1_1.jpg');
      expect(url).toBe('https://r2.cloudflarestorage.com/signed-url-test');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('upload-photo', {
        body: {
          action: 'get-signed-url',
          r2Key: 'prendas/user1/prenda1_1.jpg',
        },
      });
    });

    test('debe retornar null si la Edge Function devuelve un error', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Non-2xx status code' },
      });

      const url = await R2Service.getSignedUrlFromR2('prendas/user1/invalid.jpg');
      expect(url).toBeNull();
    });
  });

  describe('getResolvedImageUri', () => {
    test('debe retornar localUri si es una ruta local válida file:// o http(s)://', async () => {
      const localFile = 'file:///data/user/photo.jpg';
      const resolved = await R2Service.getResolvedImageUri(localFile, 'prendas/user/photo.jpg');
      expect(resolved).toBe(localFile);
    });

    test('debe resolver la URL firmada remota si no hay localUri pero hay r2Key', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { signedUrl: 'https://signed-url.com/photo.jpg' },
        error: null,
      });

      const resolved = await R2Service.getResolvedImageUri(null, 'prendas/user/unique_r2_key.jpg');
      expect(resolved).toBe('https://signed-url.com/photo.jpg');
    });
  });

  describe('deletePhotoFromR2', () => {
    test('debe retornar true inmediatamente si r2Key es vacía', async () => {
      const res = await R2Service.deletePhotoFromR2('');
      expect(res).toBe(true);
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    test('debe invocar la acción delete en la Edge Function', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const res = await R2Service.deletePhotoFromR2('prendas/user1/delete_me.jpg');
      expect(res).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('upload-photo', {
        body: {
          action: 'delete',
          r2Key: 'prendas/user1/delete_me.jpg',
        },
      });
    });
  });
});
