import { User } from '@supabase/supabase-js';
import { supabase } from '../database/supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

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
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('Error al guardar profile en Supabase:', error);
        return null;
      }

      return data as UserProfile;
    } catch (e) {
      console.error('Excepción en ProfileService.upsertProfile:', e);
      return null;
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
