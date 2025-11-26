import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';

// On récupère les clés sécurisées
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Sécurité basique pour éviter le crash si le .env est mal lu
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("⚠️ Attention: Clés Supabase manquantes ou non chargées.");
}

export const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "", {
  auth: {
    storage: AsyncStorage, // <--- C'EST LE PLUS IMPORTANT (Mémoire)
    autoRefreshToken: true,
    persistSession: true, // <--- On garde la session active
    detectSessionInUrl: false,
  },
});

// Rafraîchir la session quand l'app revient au premier plan
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});