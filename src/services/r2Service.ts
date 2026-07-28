import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../database/supabase';

export const R2Service = {
  
  uploadPhotoToR2: async (
    localUri: string,
    prendaId: string,
    index: 1 | 2
  ): Promise<string | null> => {
    try {
      if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
        return null;
      }

      // Asegurar formato file:// válido para FileSystem
      const formattedUri = localUri.startsWith('/') ? `file://${localUri}` : localUri;

      // Leer la imagen en base64 de manera segura
      const base64Data = await FileSystem.readAsStringAsync(formattedUri, {
        encoding: 'base64',
      });

      const { data, error } = await supabase.functions.invoke('upload-photo', {
        body: {
          action: 'upload',
          prendaId,
          index,
          imageBase64: base64Data,
          mimeType: 'image/jpeg',
        },
      });

      console.log('📡 Invocando upload-photo a Supabase Edge Function...');
      console.log('📌 RAW DATA:', JSON.stringify(data, null, 2));

      if (error) {
        let serverErrorMsg = error.message;
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errJson = await error.context.json();
            serverErrorMsg = errJson.error || JSON.stringify(errJson);
          }
        } catch (_) {}
        console.error('❌ DETALLE DEL ERROR DE LA EDGE FUNCTION:', serverErrorMsg);
        return null;
      }

      if (!data?.r2Key) {
        console.error('⚠️ Edge Function no devolvió r2Key:', data);
        return null;
      }

      return data.r2Key as string;
    } catch (e: any) {
      console.error('Excepción en R2Service.uploadPhotoToR2:', e);
      return null;
    }
  },

  /**
   * Obtiene una URL firmada temporal (Presigned Signed URL) para visualizar una foto remota desde el bucket privado de Cloudflare R2.
   */
  getSignedUrlFromR2: async (r2Key: string): Promise<string | null> => {
    try {
      if (!r2Key) return null;

      const { data, error } = await supabase.functions.invoke('upload-photo', {
        body: {
          action: 'get-signed-url',
          r2Key,
        },
      });

      if (error || !data?.signedUrl) {
        console.error('Error al obtener Signed URL de R2:', error || data?.error);
        return null;
      }

      return data.signedUrl as string;
    } catch (e: any) {
      console.error('Excepción en R2Service.getSignedUrlFromR2:', e);
      return null;
    }
  },

  /**
   * Elimina un objeto del bucket privado de Cloudflare R2 pasando su r2Key a la Supabase Edge Function.
   */
  deletePhotoFromR2: async (r2Key: string): Promise<boolean> => {
    try {
      if (!r2Key) return true;

      const { data, error } = await supabase.functions.invoke('upload-photo', {
        body: {
          action: 'delete',
          r2Key,
        },
      });

      if (error || !data?.success) {
        console.error('Error al eliminar foto en R2:', error || data?.error);
        return false;
      }

      return true;
    } catch (e: any) {
      console.error('Excepción en R2Service.deletePhotoFromR2:', e);
      return false;
    }
  },
};
