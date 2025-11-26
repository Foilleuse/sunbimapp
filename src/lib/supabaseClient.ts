import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let supabaseInstance: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase config missing!');
  console.error('URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('Key:', supabaseAnonKey ? 'OK' : 'MISSING');
  console.error('⚠️ Supabase client will be NULL. App will show error in UI.');
} else {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
  }
}

export const supabase = supabaseInstance;
