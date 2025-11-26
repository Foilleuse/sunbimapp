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
    let isMounted = true;

    // 1. LE TIMER DE SÉCURITÉ (L'Anti-Blocage)
    // Si Supabase ne répond pas en 1.5 secondes, on force l'ouverture.
    const safetyTimer = setTimeout(() => {
        if (isMounted && loading) {
            console.log("⚠️ Timeout Supabase : On force l'affichage (Mode Déconnecté)");
            setLoading(false);
        }
    }, 1500);

    // 2. La vérification réelle
    const initAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (isMounted) {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            }
        } catch (e) {
            console.error("Erreur Auth Init:", e);
        } finally {
            // Si ça répond vite, on arrête le chargement ici
            if (isMounted) setLoading(false);
        }
    };

    initAuth();

    // 3. Écouteur de changements
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        setLoading(false);
      }
    });

    return () => {
        isMounted = false;
        clearTimeout(safetyTimer);
        subscription.unsubscribe();
    };
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
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.error("Erreur Logout:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};