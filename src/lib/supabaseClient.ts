import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';

// 👇 COLLE TES VRAIES CLÉS ICI (Celles du fichier .env)
// Ne laisse pas process.env pour ce test, on veut être sûr !
const SUPABASE_URL = "https://nnaboyzmqofqnehzmrnp.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uYWJveXptcW9mcW5laHptcm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjM0NTcsImV4cCI6MjA3MjYzOTQ1N30.EU9YFvbtKd8eX5ep54CDMF9xaUCgKZ3TihXLKbAb6pA"; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: null, 
    autoRefreshToken: true,
    persistSession: false, 
    detectSessionInUrl: false,
  },
});

// Rafraichissement automatique
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});