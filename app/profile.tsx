import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { useAuth } from '../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, X, Heart, MessageCircle } from 'lucide-react-native'; 
import { DrawingViewer } from '../src/components/DrawingViewer';
import { SunbimHeader } from '../src/components/SunbimHeader'; // On peut réutiliser le header si on veut, mais ici on garde le custom avec la croix

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  
  // --- ETATS DONNÉES ---
  const [userDrawings, setUserDrawings] = useState<any[]>([]);
  const [loadingDrawings, setLoadingDrawings] = useState(true);
  const [totalLikes, setTotalLikes] = useState(0);

  // --- ETATS MODALE (Pour voir en grand) ---
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showClouds, setShowClouds] = useState(true); // Option pour masquer le fond

  // --- ETATS FORMULAIRE (Si pas connecté) ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1;
  const ITEM_SIZE = (screenWidth - SPACING) / 2;

  // --- CHARGEMENT DES DESSINS ---
  useEffect(() => {
    if (user) fetchUserDrawings();
  }, [user]);

  const fetchUserDrawings = async () => {
    try {
        // On récupère TOUS les dessins de l'utilisateur, triés par date
        const { data, error } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const drawings = data || [];
        setUserDrawings(drawings);
        
        // Calcul des likes totaux
        const likes = drawings.reduce((acc: number, curr: any) => acc + (curr.likes_count || 0), 0);
        setTotalLikes(likes);

    } catch (e) {
        console.error("Erreur profil:", e);
    } finally {
        setLoadingDrawings(false);
    }
  };

  // --- ACTIONS AUTH ---
  const handleEmailAuth = async () => {
    setFormLoading(true);
    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            Alert.alert("Vérifie tes emails !", "Un lien de confirmation t'a été envoyé.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // On recharge la page (le useEffect s'en charge car user change)
        }
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
    } finally {
        setFormLoading(false);
    }
  };

  const handleSignOut = async () => {
      await signOut();
      router.replace('/'); 
  };

  // --- RENDU VIGNETTE (Comme Galerie) ---
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => setSelectedDrawing(item)}
        style={{ 
            width: ITEM_SIZE, height: ITEM_SIZE, 
            marginBottom: SPACING, backgroundColor: '#F9F9F9', overflow: 'hidden' 
        }}
    >
        <DrawingViewer
            imageUri={item.cloud_image_url}
            canvasData={item.canvas_data}
            viewerSize={ITEM_SIZE}
            transparentMode={false} 
            startVisible={true}
            animated={false}
        />
    </TouchableOpacity>
  );

  // --- EN-TÊTE DE LA LISTE (Infos Profil) ---
  const ProfileHeader = () => (
    <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
                <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <User size={40} color="#666" />
                </View>
            )}
        </View>

        <Text style={styles.displayName}>{profile?.display_name || user?.email?.split('@')[0]}</Text>
        {/* <Text style={styles.email}>{user?.email}</Text> */}
        
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userDrawings.length}</Text>
                <Text style={styles.statLabel}>Dessins</Text>
            </View>
            <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalLikes}</Text>
                <Text style={styles.statLabel}>J'aimes</Text>
            </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
            <LogOut size={16} color="#FFF" />
            <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.galleryTitle}>Ma collection</Text>
    </View>
  );

  if (authLoading) return <View style={styles.container}><ActivityIndicator color="#000"/></View>;

  return (
    <View style={styles.container}>
       
       {/* HEADER NAVIGATION */}
       <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                <X color="#000" size={28} />
            </TouchableOpacity>
            <Text style={styles.headerText}>{user ? "mon profil" : "connexion"}</Text>
       </View>

       {user ? (
            // --- ÉCRAN CONNECTÉ : LISTE AVEC HEADER ---
            <FlatList
                data={userDrawings}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={{ gap: SPACING }}
                ListHeaderComponent={ProfileHeader}
                contentContainerStyle={{ paddingBottom: 50 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>Tu n'as pas encore posté de dessin.</Text>
                    </View>
                }
            />
       ) : (
            // --- ÉCRAN NON CONNECTÉ : FORMULAIRE ---
            <View style={styles.formContainer}>
                <Text style={styles.welcomeText}>Connecte-toi pour retrouver tes dessins.</Text>
                <View style={styles.inputWrapper}>
                    <Mail size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
                </View>
                <View style={styles.inputWrapper}>
                    <Lock size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
                </View>
                <TouchableOpacity style={styles.authBtn} onPress={handleEmailAuth} disabled={formLoading}>
                    {formLoading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.authBtnText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                    <Text style={styles.switchText}>{isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? Créer un compte"}</Text>
                </TouchableOpacity>
            </View>
       )}

       {/* --- MODALE VISUALISATION (Copie simplifiée de la Galerie) --- */}
       <Modal animationType="slide" transparent={false} visible={selectedDrawing !== null} onRequestClose={() => setSelectedDrawing(null)}>
            {selectedDrawing && (
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedDrawing(null)} style={styles.closeModalBtn}>
                            <X color="#000" size={32} />
                        </TouchableOpacity>
                    </View>
                    <Pressable 
                        onPressIn={() => setIsHolding(true)} onPressOut={() => setIsHolding(false)}
                        style={{ width: screenWidth, height: screenWidth, backgroundColor: '#F0F0F0' }}
                    >
                        <DrawingViewer
                            imageUri={selectedDrawing.cloud_image_url}
                            canvasData={isHolding ? [] : selectedDrawing.canvas_data}
                            viewerSize={screenWidth}
                            transparentMode={!showClouds}
                            startVisible={false} animated={true}
                        />
                    </Pressable>
                    <View style={styles.modalFooter}>
                        <View>
                            <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>
                            <Text style={styles.dateText}>Le {new Date(selectedDrawing.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.statsRowSmall}>
                             <Heart color="#000" size={20} /><Text style={styles.statTextSmall}>{selectedDrawing.likes_count || 0}</Text>
                        </View>
                    </View>
                </View>
            )}
       </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  
  // NAV HEADER
  navHeader: { paddingTop: 60, paddingBottom: 15, alignItems: 'center', borderBottomWidth: 1, borderColor: '#F5F5F5', flexDirection: 'row', justifyContent: 'center' },
  headerText: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { position: 'absolute', left: 20, top: 60 },

  // PROFIL HEADER
  profileHeader: { alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
  avatarContainer: { marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 24, fontWeight: '900', marginBottom: 5 },
  email: { fontSize: 14, color: '#999', marginBottom: 20 },
  
  statsRow: { flexDirection: 'row', gap: 40, marginBottom: 25 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#000', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30 },
  logoutText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  divider: { width: '100%', height: 1, backgroundColor: '#F0F0F0', marginTop: 30, marginBottom: 15 },
  galleryTitle: { fontSize: 16, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 20, marginBottom: 10 },

  // FORMULAIRE
  formContainer: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', marginTop: -50 },
  welcomeText: { fontSize: 24, fontWeight: '800', marginBottom: 30, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%' },
  authBtn: { backgroundColor: '#000', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },

  // EMPTY STATE
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999' },

  // MODALE
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { width: '100%', height: 100, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeModalBtn: { padding: 5 },
  modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  drawingLabel: { fontSize: 20, fontWeight: '800', color: '#000' },
  dateText: { fontSize: 14, color: '#999' },
  statsRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTextSmall: { fontWeight: '600', fontSize: 16 },
});