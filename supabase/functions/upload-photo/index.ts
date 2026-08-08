import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanSecret(val: string | undefined): string {
  if (!val) return '';
  return val
    .replace(/^["']|["']$/g, '') // Quitar comillas al inicio o final
    .replace(/[\r\n\t]/g, '')    // Quitar saltos de línea y tabulaciones invisibles
    .replace(/^(r2_[a-z_]+)=/i, '') // Quitar etiquetas de nombre si se pegaron
    .trim();                     // Quitar espacios extra
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const R2_ACCOUNT_ID = cleanSecret(Deno.env.get("R2_ACCOUNT_ID"));
    const R2_ACCESS_KEY_ID = cleanSecret(Deno.env.get("R2_ACCESS_KEY_ID"));
    const R2_SECRET_ACCESS_KEY = cleanSecret(Deno.env.get("R2_SECRET_ACCESS_KEY"));
    const R2_BUCKET_NAME = cleanSecret(Deno.env.get("R2_BUCKET_NAME"));
    const SUPABASE_URL = cleanSecret(Deno.env.get("SUPABASE_URL"));
    const SUPABASE_ANON_KEY = cleanSecret(Deno.env.get("SUPABASE_ANON_KEY"));

    console.log("Invocando Edge Function upload-photo. Account ID:", R2_ACCOUNT_ID, "Bucket:", R2_BUCKET_NAME);

    const missingSecrets = [];
    if (!R2_ACCOUNT_ID) missingSecrets.push("R2_ACCOUNT_ID");
    if (!R2_ACCESS_KEY_ID) missingSecrets.push("R2_ACCESS_KEY_ID");
    if (!R2_SECRET_ACCESS_KEY) missingSecrets.push("R2_SECRET_ACCESS_KEY");
    if (!R2_BUCKET_NAME) missingSecrets.push("R2_BUCKET_NAME");

    if (missingSecrets.length > 0) {
      const msg = `Faltan las siguientes variables en Supabase Secrets: ${missingSecrets.join(", ")}`;
      console.error(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Falta header de autorización");
      return new Response(JSON.stringify({ error: 'Falta token de autorización' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    console.log(user?.id);
    if (authError || !user) {
      console.error("Error autenticando usuario JWT:", authError);
      return new Response(JSON.stringify({ error: 'Token de sesión no válido o expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const { action, r2Key, prendaId, index, imageBase64, mimeType } = body;

    console.log(`Acción: ${action}, Usuario ID: ${userId}, PrendaId: ${prendaId}, Index: ${index}`);

    if (!action) {
      return new Response(JSON.stringify({ error: 'Acción no especificada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACCIÓN 1: SUBIR FOTO A BUCKET PRIVADO R2
    if (action === 'upload') {
      if (!prendaId || !index || (index !== 1 && index !== 2) || !imageBase64) {
        console.error("Parámetros de subida inválidos en body");
        return new Response(JSON.stringify({ error: 'Parámetros de subida no válidos' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const finalMime = validMimes.includes(mimeType) ? mimeType : 'image/jpeg';
      const key = `prendas/${userId}/${prendaId}_${index}.jpg`;

      // Convertir base64 a Buffer binario Uint8Array
      const binaryString = atob(imageBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Validar tamaño máximo (5 MB)
      if (bytes.length > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'La imagen excede el límite de 5 MB' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Subiendo a R2 key: ${key}, tamaño: ${bytes.length} bytes...`);

      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: bytes,
        ContentType: finalMime,
      }));

      console.log(`Subida exitosa a R2: ${key}`);

      return new Response(JSON.stringify({ success: true, r2Key: key }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACCIÓN 2: OBTENER URL FIRMADA (PRESIGNED URL)
    if (action === 'get-signed-url') {
      if (!r2Key || !r2Key.startsWith('prendas/')) {
        console.error(`Acceso no autorizado a r2Key: ${r2Key} para usuario ${userId}`);
        return new Response(JSON.stringify({ error: 'Acceso no autorizado a este recurso de R2' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      console.log(`Signed URL generada exitosamente para r2Key: ${r2Key}`);

      return new Response(JSON.stringify({ success: true, signedUrl }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACCIÓN 3: ELIMINAR OBJETO EN R2
    if (action === 'delete') {
      if (!r2Key || !r2Key.startsWith('prendas/')) {
        console.error(`Acceso no autorizado para eliminar r2Key: ${r2Key} por usuario ${userId}`);
        return new Response(JSON.stringify({ error: 'Acceso no autorizado para eliminar este recurso de R2' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await s3.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
      }));

      console.log(`Objeto eliminado exitosamente en R2: ${r2Key}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Acción no permitida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Excepción atrapada en Edge Function upload-photo:', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});