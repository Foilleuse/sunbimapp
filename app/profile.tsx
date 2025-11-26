import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { useAuth } from '../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, Settings, Heart, X } from 'lucide-react-native'; 
import { DrawingViewer } from '../src/components/DrawingViewer';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  
  const [userDrawings, setUserDrawings] = useState<any[]>([]);
  const [loadingDrawings, setLoadingDrawings] = useState(true);
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1;
  const ITEM_SIZE = (screenWidth - SPACING) / 2;

  useEffect(() => {
    if (user) fetchUserDrawings();
  }, [user]);

  const fetchUserDrawings = async () => {
    try {
        const { data, error } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        setUserDrawings(data || []);
    } catch (e) {
        console.error("Erreur profil:", e);
    } finally {
        setLoadingDrawings(false);
    }
  };

  const handleEmailAuth = async () => {
    setFormLoading(true);
    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            Alert.alert("Vérifie tes emails !", "Lien envoyé.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (e: any) { Alert.alert("Erreur", e.message); } finally { setFormLoading(false); }
  };

  const handleSignOut = async () => { await signOut(); router.replace('/'); };
  const handleEditProfile = () => Alert.alert("Bientôt", "Édition profil à venir");

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => setSelectedDrawing(item)}
        style={{ width: ITEM_SIZE, height: ITEM_SIZE, marginBottom: SPACING, backgroundColor: '#F9F9F9', overflow: 'hidden' }}
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

  if (authLoading) return <View style={styles.container}><ActivityIndicator color="#000"/></View>;

  return (
    <View style={styles.container}>
       
       {user ? (
            <View style={{flex: 1}}>
                
                {/* HEADER ACTIONS (Aligné à droite) */}
                <View style={styles.navHeader}>
                    <View style={{flex: 1}} /> {/* Spacer pour pousser à droite */}
                    <View style={styles.topRightActions}>
                        <TouchableOpacity onPress={handleEditProfile} style={styles.iconBtn}>
                            <Settings color="#000" size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn}>
                            <LogOut color="#000" size={24} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* CARTE D'IDENTITÉ (Plus haute, aérée) */}
                <View style={styles.profileCard}>
                    <View style={styles.profileRow}>
                        <View style={styles.avatarContainer}>
                            {profile?.avatar_url ? (
                                <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}><User size={40} color="#666" /></View>
                            )}
                        </View>
                        
                        <View style={styles.textsContainer}>
                            <Text style={styles.displayName}>{profile?.display_name || "Anonyme"}</Text>
                            <Text style={styles.bio}>{profile?.bio || "Chasseur de nuages."}</Text>
                        </View>
                    </View>
                    {/* Ligne de séparation plus bas pour donner de l'espace */}
                    <View style={styles.divider} />
                </View>

                {/* GALERIE */}
                <FlatList
                    data={userDrawings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ gap: SPACING }}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}><Text style={styles.emptyText}>Aucun dessin pour l'instant.</Text></View>
                    }
                />
            </View>
       ) : (
            // FORMULAIRE (Inchangé)
            <View style={styles.formContainer}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeLoginBtn}>
                     <X color="#000" size={28} />
                </TouchableOpacity>
                
                <Text style={styles.welcomeText}>Connecte-toi.</Text>
                <View style={styles.inputWrapper}><Mail size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} /></View>
                <View style={styles.inputWrapper}><Lock size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} /></View>
                <TouchableOpacity style={styles.authBtn} onPress={handleEmailAuth} disabled={formLoading}>
                    {formLoading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.authBtnText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}><Text style={styles.switchText}>{isSignUp ? "Déjà un compte ?" : "Pas de compte ?"}</Text></TouchableOpacity>
            </View>
       )}

       {/* MODALE ZOOM */}
       <Modal animationType="slide" transparent={false} visible={selectedDrawing !== null} onRequestClose={() => setSelectedDrawing(null)}>
            {selectedDrawing && (
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedDrawing(null)} style={styles.closeModalBtn}><X color="#000" size={32} /></TouchableOpacity>
                    </View>
                    <Pressable onPressIn={() => setIsHolding(true)} onPressOut={() => setIsHolding(false)} style={{ width: screenWidth, height: screenWidth, backgroundColor: '#F0F0F0' }}>
                        <DrawingViewer
                            imageUri={selectedDrawing.cloud_image_url}
                            canvasData={isHolding ? [] : selectedDrawing.canvas_data}
                            viewerSize={screenWidth}
                            transparentMode={false} // On voit le fond
                            startVisible={false} animated={true}
                        />
                    </Pressable>
                    <View style={styles.modalFooter}>
                        <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>
                        <View style={{flexDirection:'row', gap:5, alignItems:'center'}}>
                             <Heart color="#000" size={20} /><Text style={{fontWeight:'600'}}>{selectedDrawing.likes_count || 0}</Text>
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
  
  // NAV HEADER (Juste les actions à droite)
  navHeader: { 
      paddingTop: 20, // Moins de padding car dans une modale native, le header est déjà safe
      paddingBottom: 10, 
      paddingHorizontal: 20, 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#FFF',
  },
  iconBtn: { padding: 5 },
  topRightActions: { flexDirection: 'row', gap: 15 },
  
  // PROFIL CARD (Plus haute et aérée)
  profileCard: { 
      paddingHorizontal: 25, 
      paddingTop: 20, // Espace au dessus
      paddingBottom: 10, 
      backgroundColor: '#FFF' 
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 25 },
  avatar: { width: 90, height: 90, borderRadius: 45 }, // Avatar un peu plus grand
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  
  textsContainer: { flex: 1, justifyContent: 'center' },
  displayName: { fontSize: 26, fontWeight: '900', color: '#000', marginBottom: 8 },
  bio: { fontSize: 15, color: '#666', lineHeight: 22 },

  divider: { width: '100%', height: 1, backgroundColor: '#F0F0F0', marginTop: 35, marginBottom: 15 }, // Marge augmentée

  // FORMULAIRE
  formContainer: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', marginTop: -50 },
  closeLoginBtn: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  welcomeText: { fontSize: 24, fontWeight: '800', marginBottom: 30, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%' },
  authBtn: { backgroundColor: '#000', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999' },

  // MODALE
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { width: '100%', height: 100, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeModalBtn: { padding: 5 },
  modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  drawingLabel: { fontSize: 20, fontWeight: '800', color: '#000' },
});