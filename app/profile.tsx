import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { useAuth } from '../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, X } from 'lucide-react-native'; 

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();
  
  // États formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // --- ACTIONS ---
  const handleEmailAuth = async () => {
    setAuthLoading(true);
    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            Alert.alert("Vérifie tes emails !", "Un lien de confirmation t'a été envoyé.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // Une fois connecté, on peut revenir en arrière
            router.back();
        }
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
    } finally {
        setAuthLoading(false);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator color="#000"/></View>;

  return (
    <View style={styles.container}>
       
       {/* Header simple avec croix de fermeture */}
       <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                <X color="#000" size={28} />
            </TouchableOpacity>
            <Text style={styles.headerText}>{user ? "mon profil" : "connexion"}</Text>
       </View>

       {/* --- ÉCRAN CONNECTÉ --- */}
       {user ? (
            <View style={styles.content}>
                <View style={styles.avatarContainer}>
                    {profile?.avatar_url ? (
                        <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <User size={40} color="#666" />
                        </View>
                    )}
                </View>

                <Text style={styles.displayName}>
                    {profile?.display_name || user.email?.split('@')[0]}
                </Text>
                <Text style={styles.email}>{user.email}</Text>
                
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>Dessins</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>Likes</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
                    <LogOut size={20} color="#FFF" />
                    <Text style={styles.logoutText}>Se déconnecter</Text>
                </TouchableOpacity>
            </View>
       ) : (
            /* --- ÉCRAN NON CONNECTÉ --- */
            <View style={styles.formContainer}>
                <Text style={styles.welcomeText}>Rejoins les nuages.</Text>
                
                <View style={styles.inputWrapper}>
                    <Mail size={20} color="#999" style={styles.inputIcon}/>
                    <TextInput 
                        placeholder="Email" value={email} onChangeText={setEmail} 
                        autoCapitalize="none" style={styles.input} 
                    />
                </View>

                <View style={styles.inputWrapper}>
                    <Lock size={20} color="#999" style={styles.inputIcon}/>
                    <TextInput 
                        placeholder="Mot de passe" value={password} onChangeText={setPassword} 
                        secureTextEntry style={styles.input} 
                    />
                </View>

                <TouchableOpacity style={styles.authBtn} onPress={handleEmailAuth} disabled={authLoading}>
                    {authLoading ? <ActivityIndicator color="#FFF"/> : (
                        <Text style={styles.authBtnText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                    <Text style={styles.switchText}>
                        {isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? Créer un compte"}
                    </Text>
                </TouchableOpacity>
            </View>
       )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingTop: 60, paddingBottom: 20, alignItems: 'center', borderBottomWidth: 1, borderColor: '#F5F5F5', flexDirection: 'row', justifyContent: 'center' },
  headerText: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { position: 'absolute', left: 20, top: 60 }, // Croix à gauche
  
  content: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  formContainer: { flex: 1, paddingHorizontal: 30, justifyContent: 'center' },
  
  avatarContainer: { marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 22, fontWeight: '800', marginBottom: 5 },
  email: { fontSize: 14, color: '#999', marginBottom: 30 },
  
  statsRow: { flexDirection: 'row', gap: 40, marginBottom: 40 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#666' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30 },
  logoutText: { color: '#FFF', fontWeight: '600' },

  welcomeText: { fontSize: 24, fontWeight: '800', marginBottom: 30, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%' },
  authBtn: { backgroundColor: '#000', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },
});