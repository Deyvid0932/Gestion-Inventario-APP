import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../database/supabase';
import { Session, User } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

const IS_GUEST_KEY = 'user_is_guest';

export const AuthService = {
  // Iniciar sesión con Google usando OAuth de Supabase
  signInWithGoogle: async (): Promise<{ session: Session | null; user: User | null }> => {
    try {
      const redirectTo = makeRedirectUri({
        scheme: 'inventario-app-supabase',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });


      if (error) throw error;
      if (!data?.url) throw new Error('No se pudo generar la URL de autenticación');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        // Extraer token o código desde la URL de retorno
        const urlStr = res.url;

        let code: string | null = null;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        if (urlStr.includes('code=')) {
          const match = urlStr.match(/code=([^&]+)/);
          if (match) code = match[1];
        } else if (urlStr.includes('#') || urlStr.includes('?')) {
          const hashOrQuery = urlStr.includes('#') ? urlStr.split('#')[1] : urlStr.split('?')[1];
          const params = new URLSearchParams(hashOrQuery);
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
        }

        if (code) {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          await AuthService.clearGuestMode();
          return { session: sessionData.session, user: sessionData.user };
        } else if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          await AuthService.clearGuestMode();
          return { session: sessionData.session, user: sessionData.user };
        }
      }

      const currentSession = await AuthService.getSession();
      return { session: currentSession, user: currentSession?.user ?? null };
    } catch (err) {
      console.error('Error durante la autenticación con Google:', err);
      throw err;
    }
  },

  // Crear el perfil si aún no existe
  createProfileIfNeeded: async (user: User) => {
    try {
      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (selectError) throw selectError;

      if (!existingProfile) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              '',
            email: user.email,
            avatar_url:
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              '',
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error creando perfil:', error);
      throw error;
    }
  },

  // Cerrar sesión
  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  },

  // Obtener sesión actual de Supabase
  getSession: async (): Promise<Session | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch (e) {
      console.error('Error al obtener sesión:', e);
      return null;
    }
  },

  // Guardar que el usuario eligió ser invitado
  setGuestMode: async () => {
    await AsyncStorage.setItem(IS_GUEST_KEY, 'true');
  },

  // Verificar si está en modo invitado
  isGuestMode: async (): Promise<boolean> => {
    const isGuest = await AsyncStorage.getItem(IS_GUEST_KEY);
    return isGuest === 'true';
  },

  // Salir del modo invitado (cuando decide registrarse)
  clearGuestMode: async () => {
    await AsyncStorage.removeItem(IS_GUEST_KEY);
  }
};
