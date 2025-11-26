import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Vérification initiale
    const initAuth = async () => {
        try {
            // On demande à la mémoire si une session existe
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                setSession(session);
                setUser(session.user);
                await fetchProfile(session.user.id);
            }
        } catch (e) {
            console.error("Erreur Auth:", e);
        } finally {
            // Quoi qu'il arrive (trouvé ou pas), on arrête de charger
            setLoading(false);
        }
    };

    initAuth();

    // 2. Écouteur temps réel (Connexion / Déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
          fetchProfile(session.user.id);
      } else {
          setProfile(null);
      }
      // Si l'état change, on est sûr que le chargement est fini
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) setProfile(data);
    } catch (e) {
      console.error("Erreur profil:", e);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};