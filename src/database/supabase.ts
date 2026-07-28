import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const isValidUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

if (!isValidUrl || !supabaseAnonKey) {
  console.error('❌ [SUPABASE CONFIG ERROR] Falta configurar EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env o en los Secrets de EAS Build.');
}

export const supabase = createClient(
  isValidUrl ? supabaseUrl : 'https://unconfigured.supabase.co',
  supabaseAnonKey || 'unconfigured-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
