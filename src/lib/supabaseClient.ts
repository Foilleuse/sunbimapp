import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Tes clés (Vérifie qu'elles sont bonnes !)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Clés Supabase manquantes !");
}

export const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "", {
  auth: {
    // 🛑 ON COUPE TOUT STOCKAGE POUR LE MOMENT
    storage: null,
    autoRefreshToken: true,
    persistSession: false, // Pas de mémoire = Pas de bug de démarrage
    detectSessionInUrl: false,
  },
});