import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../database/supabase';

const extractEdgeErrorDetail = async (error: any): Promise<string> => {
  const baseMsg = error?.message || String(error);
  try {
    const ctx = error?.context;
    if (!ctx) return baseMsg;
    const status = ctx.status ? `[HTTP ${ctx.status}] ` : '';
    const clone = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
    if (typeof clone.text === 'function') {
      const rawText = await clone.text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          return `${status}${parsed?.error || parsed?.message || rawText}`;
        } catch (_) {
          return `${status}${rawText}`;
        }
      }
    }
  } catch (_) {}
  return baseMsg;
};

export const R2Service = {
  
  uploadPhotoToR2: async (
    localUri: string,
    garmentId: string,
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
          garmentId,
          prendaId: garmentId,
          index,
          imageBase64: base64Data,
          mimeType: 'image/jpeg',
        },
      });


      if (error) {
        const serverErrorMsg = await extractEdgeErrorDetail(error);
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
        if (error) {
          const detail = await extractEdgeErrorDetail(error);
          console.error('❌ DETALLE DEL ERROR DE LA EDGE FUNCTION (get-signed-url):', detail);
        }
        return null;
      }

      return data.signedUrl as string;
    } catch (e: any) {
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
        const detail = error ? await extractEdgeErrorDetail(error) : data?.error;
        console.error('❌ DETALLE DEL ERROR DE LA EDGE FUNCTION (delete):', detail);
        return false;
      }

      return true;
    } catch (e: any) {
      console.error('Excepción en R2Service.deletePhotoFromR2:', e);
      return false;
    }
  },

  /**
   * Resuelve la URI de visualización para una prenda.
   * Si localUri es válida (file:// o /) y existe en disco local, la retorna inmediatamente.
   * De lo contrario, descarga la imagen desde Cloudflare R2 a disco local permanente para permitir acceso 100% offline.
   */
  getResolvedImageUri: async (
    localUri?: string | null,
    r2Key?: string | null
  ): Promise<string | null> => {
    try {
      // 1. Probar primero si hay URI local válida (file://, http/s, o /)
      if (localUri && localUri.trim() !== '') {
        let formatted = localUri.trim();
        if (formatted.startsWith('/') && !formatted.startsWith('file://')) {
          formatted = `file://${formatted}`;
        }
        if (formatted.startsWith('file://') || formatted.startsWith('http://') || formatted.startsWith('https://')) {
          if (formatted.startsWith('file://')) {
            const info = await FileSystem.getInfoAsync(formatted).catch(() => null);
            if (info && info.exists) {
              return formatted;
            }
          } else {
            return formatted;
          }
        } else if (!r2Key) {
          r2Key = formatted;
        }
      }

      // 2. Si no existe en disco local o no hay localUri, consultar r2Key
      if (r2Key && r2Key.trim() !== '') {
        const cleanKey = r2Key.trim();
        const now = Date.now();
        const cached = r2UrlCache.get(cleanKey);
        if (cached && cached.expiresAt > now && cached.url) {
          return cached.url;
        }

        const safeFileName = `cache_${cleanKey.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
        const localCachePath = `${FileSystem.documentDirectory}${safeFileName}`;

        // Verificar si la foto ya fue descargada a disco local previamente (Disponibilidad Offline)
        const cacheInfo = await FileSystem.getInfoAsync(localCachePath).catch(() => null);
        if (cacheInfo && cacheInfo.exists) {
          r2UrlCache.set(cleanKey, { url: localCachePath, expiresAt: now + 365 * 24 * 60 * 60 * 1000 });
          return localCachePath;
        }

        // Deduplicar peticiones en vuelo para la misma clave R2
        let pending = inFlightUrlRequests.get(cleanKey);
        if (!pending) {
          pending = R2Service.getSignedUrlFromR2(cleanKey).finally(() => {
            inFlightUrlRequests.delete(cleanKey);
          });
          inFlightUrlRequests.set(cleanKey, pending);
        }

        const signedUrl = await pending;
        if (signedUrl) {
          r2UrlCache.set(cleanKey, { url: signedUrl, expiresAt: now + 50 * 60 * 1000 });

          // Descargar en segundo plano a disco local para consumo offline permanente
          FileSystem.downloadAsync(signedUrl, localCachePath)
            .then(({ status }) => {
              if (status === 200) {
                r2UrlCache.set(cleanKey, { url: localCachePath, expiresAt: now + 365 * 24 * 60 * 60 * 1000 });
              }
            })
            .catch(() => {});

          return signedUrl;
        } else {
          // Si no hay conexión (offline) y teníamos una URL en caché previa, usarla como fallback
          if (cached && cached.url) {
            return cached.url;
          }
          r2UrlCache.set(cleanKey, { url: null, expiresAt: now + 2 * 60 * 1000 });
        }
      }

      if (localUri) {
        return localUri.startsWith('/') && !localUri.startsWith('file://') ? `file://${localUri}` : localUri;
      }
      return null;
    } catch (e) {
      if (localUri) {
        return localUri.startsWith('/') && !localUri.startsWith('file://') ? `file://${localUri}` : localUri;
      }
      return null;
    }
  },
};

const r2UrlCache = new Map<string, { url: string | null; expiresAt: number }>();
const inFlightUrlRequests = new Map<string, Promise<string | null>>();
