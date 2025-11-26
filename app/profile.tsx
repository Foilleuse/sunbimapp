import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { useAuth } from '../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, ChevronLeft, Settings, AlertCircle, Heart } from 'lucide-react-native'; 
import { DrawingViewer } from '../src/components/DrawingViewer';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  
  // --- ETATS ---
  const [historyItems, setHistoryItems] = useState<any[]>([]); // La liste complète (Dessins + Ratés)
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [totalLikes, setTotalLikes] = useState(0);
  const [drawingCount, setDrawingCount] = useState(0);

  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  // Formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1;
  const ITEM_SIZE = (screenWidth - SPACING) / 2;

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Récupérer TOUS les nuages passés
        const { data: clouds, error: cloudsError } = await supabase
            .from('clouds')
            .select('*')
            .lte('published_for', today) 
            .order('published_for', { ascending: false });

        if (cloudsError) throw cloudsError;

        // 2. Récupérer MES dessins
        const { data: myDrawings, error: drawingsError } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id);

        if (drawingsError) throw drawingsError;

        // 3. FUSION : On crée la liste unifiée
        const history = clouds?.map(cloud => {
            const drawing = myDrawings?.find(d => d.cloud_id === cloud.id);
            
            return {
                id: cloud.id, // ID unique pour la liste
                type: drawing ? 'drawing' : 'missed', // Type d'élément
                date: cloud.published_for,
                
                // Données pour l'affichage
                cloud_image_url: cloud.image_url,
                canvas_data: drawing ? drawing.canvas_data : [], // Vide si raté
                label: drawing ? drawing.label : null,
                likes_count: drawing ? drawing.likes_count : 0,
                created_at: drawing ? drawing.created_at : cloud.published_for
            };
        });

        setHistoryItems(history || []);
        
        // Calculs Stats
        const realDrawings = myDrawings || [];
        setDrawingCount(realDrawings.length);
        setTotalLikes(realDrawings.reduce((acc, curr) => acc + (curr.likes_count || 0), 0));

    } catch (e) {
        console.error("Erreur profil:", e);
    } finally {
        setLoadingHistory(false);
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

  // --- RENDU INTELLIGENT ---
  const renderItem = ({ item }: { item: any }) => {
    const isMissed = item.type === 'missed';

    return (
        <TouchableOpacity 
            activeOpacity={isMissed ? 1 : 0.9} // Pas de clic si raté (ou alors juste pour voir le nuage vide)
            onPress={() => !isMissed && setSelectedDrawing(item)}
            style={{ 
                width: ITEM_SIZE, height: ITEM_SIZE, 
                marginBottom: SPACING, backgroundColor: '#F9F9F9', overflow: 'hidden',
                opacity: isMissed ? 0.6 : 1 // On grise les jours ratés
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

            {/* Overlay "RATÉ" */}
            {isMissed && (
                <View style={styles.missedBadge}>
                    <AlertCircle color="#FFF" size={24} />
                    <Text style={styles.missedText}>
                        {new Date(item.date).toLocaleDateString(undefined, {day:'numeric', month:'short'})}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
  };

  if (authLoading) return <View style={styles.container}><ActivityIndicator color="#000"/></View>;

  return (
    <View style={styles.container}>
       
       <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                <ChevronLeft color="#000" size={32} />
            </TouchableOpacity>
            
            {user && (
                <View style={styles.topRightActions}>
                    <TouchableOpacity onPress={handleEditProfile} style={styles.iconBtn}>
                        <Settings color="#000" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn}>
                        <LogOut color="#000" size={24} />
                    </TouchableOpacity>
                </View>
            )}
       </View>

       {user ? (
            <View style={{flex: 1}}>
                <View style={styles.profileCard}>
                    <View style={styles.profileRow}>
                        <View style={styles.avatarContainer}>
                            {profile?.avatar_url ? (
                                <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}><User size={32} color="#666" /></View>
                            )}
                        </View>
                        <View style={styles.textsContainer}>
                            <Text style={styles.displayName}>{profile?.display_name || "Anonyme"}</Text>
                            <Text style={styles.bio}>{profile?.bio || "Chasseur de nuages."}</Text>
                            <View style={styles.miniStats}>
                                <Text style={styles.miniStatText}>{drawingCount} <Text style={styles.miniStatLabel}>dessins</Text></Text>
                                <Text style={styles.miniStatText}>•</Text>
                                <Text style={styles.miniStatText}>{totalLikes} <Text style={styles.miniStatLabel}>likes</Text></Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.divider} />
                </View>

                <FlatList
                    data={historyItems} // On utilise la liste fusionnée
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ gap: SPACING }}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}><Text style={styles.emptyText}>Chargement de l'historique...</Text></View>
                    }
                />
            </View>
       ) : (
            <View style={styles.formContainer}>
                <Text style={styles.welcomeText}>Connecte-toi.</Text>
                <View style={styles.inputWrapper}><Mail size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} /></View>
                <View style={styles.inputWrapper}><Lock size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} /></View>
                <TouchableOpacity style={styles.authBtn} onPress={handleEmailAuth} disabled={formLoading}>
                    {formLoading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.authBtnText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}><Text style={styles.switchText}>{isSignUp ? "Déjà un compte ?" : "Pas de compte ?"}</Text></TouchableOpacity>
            </View>
       )}

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
  navHeader: { paddingTop: 60, paddingBottom: 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', zIndex: 10 },
  iconBtn: { padding: 5 },
  topRightActions: { flexDirection: 'row', gap: 15 },
  
  profileCard: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#FFF' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  textsContainer: { flex: 1, justifyContent: 'center' },
  displayName: { fontSize: 22, fontWeight: '900', color: '#000', marginBottom: 4 },
  bio: { fontSize: 14, color: '#666', marginBottom: 8 },
  miniStats: { flexDirection: 'row', gap: 10 },
  miniStatText: { fontSize: 14, fontWeight: '700', color: '#000' },
  miniStatLabel: { fontWeight: '400', color: '#999' },
  divider: { width: '100%', height: 1, backgroundColor: '#F0F0F0', marginTop: 20, marginBottom: 10 },

  formContainer: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', marginTop: -50 },
  welcomeText: { fontSize: 24, fontWeight: '800', marginBottom: 30, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%' },
  authBtn: { backgroundColor: '#000', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999' },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { width: '100%', height: 100, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeModalBtn: { padding: 5 },
  modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  drawingLabel: { fontSize: 20, fontWeight: '800', color: '#000' },

  // STYLE MISSED
  missedBadge: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)', // Voile sombre
      justifyContent: 'center', alignItems: 'center',
  },
  missedText: {
      color: '#FFF', fontWeight: '800', marginTop: 5, fontSize: 14
  }
});