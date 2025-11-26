import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';

// ⚠️ COLLE TES VRAIES CLES ICI (Celles qui sont dans ton fichier .env)
// Ne laisse pas process.env pour ce test !
const SUPABASE_URL = "https://ton-projet.supabase.co";
const SUPABASE_KEY = "eyJh......"; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: null, // On simplifie le storage pour éviter les conflits AsyncStorage
    autoRefreshToken: true,
    persistSession: false, // On désactive la persistance pour tester (évite les crashs de session corrompue)
    detectSessionInUrl: false,
  },
});

// Petit écouteur pour rafraichir le token si l'app revient au premier plan
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});