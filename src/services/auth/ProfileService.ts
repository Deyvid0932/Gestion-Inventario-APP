import { User } from '@supabase/supabase-js';
import { supabase } from '../../database/supabase';
import { UserProfile } from '../../types/roles';

export const ProfileService = {
  upsertProfile: async (user: User): Promise<UserProfile | null> => {
    if (!user) return null;
    try {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const now = new Date().toISOString();

      // Verificar primero si el perfil ya existe para NO sobreescribir el campo 'active' (en caso de haber sido suspendido por un Admin)
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id, active')
        .eq('id', user.id)
        .maybeSingle();

      if (existingError) {
        console.error('[ProfileService] No se pudo consultar el perfil existente:', {
          code: existingError.code,
          message: existingError.message,
          details: existingError.details,
          hint: existingError.hint,
        });
      }

      const profilePayload: any = {
        id: user.id,
        name: fullName,
        email: user.email || '',
        avatar_url: avatarUrl,
        updated_at: now,
      };

      // Si es un perfil nuevo, por defecto está activo; si ya existe, se respeta su estado actual
      if (!existing) {
        profilePayload.active = true;
      }

      // Realizar upsert directo
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (!error && data) {
        return data as UserProfile;
      }

      if (error) {
        console.error('[ProfileService] No se pudo crear/actualizar el perfil:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }

      return await ProfileService.getProfile(user.id);
    } catch (e) {
      console.error('Excepción en ProfileService.upsertProfile:', e);
      return await ProfileService.getProfile(user.id);
    }
  },

  getProfile: async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error al consultar profile:', error);
        return null;
      }
      return data as UserProfile | null;
    } catch (e) {
      console.error('Excepción en ProfileService.getProfile:', e);
      return null;
    }
  },
};
