import { User } from '@supabase/supabase-js';
import { supabase } from '../database/supabase';
import { UserProfile } from '../types/roles';

export const ProfileService = {
  upsertProfile: async (user: User): Promise<UserProfile | null> => {
    if (!user) return null;
    try {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const now = new Date().toISOString();

      const profilePayload = {
        id: user.id,
        name: fullName,
        email: user.email || '',
        avatar_url: avatarUrl,
        active: true,
        updated_at: now,
      };

      // 1. Verificar si el perfil ya existe en Supabase
      const existing = await ProfileService.getProfile(user.id);

      if (existing) {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            name: fullName,
            email: user.email || '',
            avatar_url: avatarUrl,
            updated_at: now,
          })
          .eq('id', user.id)
          .select()
          .single();

        if (!error && data) {
          return data as UserProfile;
        }
        return existing;
      }

      // 2. Si es un usuario completamente nuevo, realizar insert
      const { data, error } = await supabase
        .from('profiles')
        .insert([profilePayload])
        .select()
        .single();

      if (error) {
        console.warn('[ProfileService] Error al insertar nuevo perfil en Supabase:', error.message);
        return await ProfileService.getProfile(user.id);
      }

      return data as UserProfile;
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
