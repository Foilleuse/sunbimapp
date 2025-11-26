import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { useAuth } from '../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, ChevronLeft, Settings, Heart, MessageCircle, X } from 'lucide-react-native'; 
import { DrawingViewer } from '../src/components/DrawingViewer';
// IMPORTANT : On réimporte la modale de commentaires
import { CommentsModal } from '../src/components/CommentsModal'; 

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  
  const [userDrawings, setUserDrawings] = useState<any[]>([]);
  const [loadingDrawings, setLoadingDrawings] = useState(true);
  
  // --- ETATS D'INTERACTION ---
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showComments, setShowComments] = useState(false); // <--- Il manquait ça
  const [isLiked, setIsLiked] = useState(false); // <--- Pour savoir si on a liké le dessin ouvert

  // Formulaire
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

  // Quand on ouvre un dessin, on vérifie si on l'a déjà liké
  useEffect(() => {
      if (selectedDrawing && user) {
          checkLikeStatus();
      }
  }, [selectedDrawing]);

  const fetchUserDrawings = async () => {
    try {
        const { data, error } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        setUserDrawings(data || []);
    } catch (e) { console.error("Erreur profil:", e); } finally { setLoadingDrawings(false); }
  };

  const checkLikeStatus = async () => {
    try {
        const { data } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', user?.id)
            .eq('drawing_id', selectedDrawing.id)
            .maybeSingle();
        setIsLiked(!!data);
    } catch (e) { console.error(e); }
  };

  // --- LOGIQUE DU LIKE (RÉTABLIE) ---
  const handleLike = async () => {
      if (!selectedDrawing || !user) return;

      const newLikedState = !isLiked;
      setIsLiked(newLikedState);
      
      // Mise à jour optimiste du compteur local
      const newCount = (selectedDrawing.likes_count || 0) + (newLikedState ? 1 : -1);
      setSelectedDrawing({...selectedDrawing, likes_count: newCount});

      // Mise à jour dans la liste globale pour que la grille soit à jour aussi
      setUserDrawings(prev => prev.map(d => d.id === selectedDrawing.id ? {...d, likes_count: newCount} : d));

      try {
          if (newLiked) {
              await supabase.from('likes').insert({ user_id: user.id, drawing_id: selectedDrawing.id });
          } else {
              await supabase.from('likes').delete().eq('user_id', user.id).eq('drawing_id', selectedDrawing.id);
          }
      } catch (e) {
          console.error("Erreur like", e);
          // Rollback si erreur
          setIsLiked(!newLiked);
      }
  };

  const totalLikes = userDrawings.reduce((acc, curr) => acc + (curr.likes_count || 0), 0);

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
            imageUri={item.cloud_image_url} canvasData={item.canvas_data} viewerSize={ITEM_SIZE}
            transparentMode={false} startVisible={true} animated={false}
        />
    </TouchableOpacity>
  );

  if (authLoading) return <View style={styles.container}><ActivityIndicator color="#000"/></View>;

  return (
    <View style={styles.container}>
       
       <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                <ChevronLeft color="#000" size={32} />
            </TouchableOpacity>
            {user && (
                <View style={styles.topRightActions}>
                    <TouchableOpacity onPress={handleEditProfile} style={styles.iconBtn}><Settings color="#000" size={24} /></TouchableOpacity>
                    <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn}><LogOut color="#000" size={24} /></TouchableOpacity>
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
                                <Text style={styles.miniStatText}>{userDrawings.length} <Text style={styles.miniStatLabel}>dessins</Text></Text>
                                <Text style={styles.miniStatText}>•</Text>
                                <Text style={styles.miniStatText}>{totalLikes} <Text style={styles.miniStatLabel}>likes</Text></Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.divider} />
                </View>

                <FlatList
                    data={userDrawings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ gap: SPACING }}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>Aucun dessin pour l'instant.</Text></View>}
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

       {/* MODALE ZOOM INTERACTIVE */}
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
                            transparentMode={false} startVisible={false} animated={true}
                        />
                    </Pressable>
                    <View style={styles.modalFooter}>
                        <View>
                            <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>
                            <Text style={styles.dateText}>Le {new Date(selectedDrawing.created_at).toLocaleDateString()}</Text>
                        </View>
                        
                        <View style={styles.statsRowSmall}>
                             {/* BOUTON LIKE ACTIF */}
                             <TouchableOpacity onPress={handleLike} style={{flexDirection:'row', alignItems:'center', gap:5, marginRight:15}}>
                                <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={24} />
                                <Text style={styles.statTextSmall}>{selectedDrawing.likes_count || 0}</Text>
                             </TouchableOpacity>

                             {/* BOUTON COMMENTAIRE ACTIF */}
                             <TouchableOpacity onPress={() => setShowComments(true)} style={{flexDirection:'row', alignItems:'center', gap:5}}>
                                <MessageCircle color="#000" size={24} />
                                <Text style={styles.statTextSmall}>{selectedDrawing.comments_count || 0}</Text>
                             </TouchableOpacity>
                        </View>
                    </View>
                    
                    {/* LA MODALE DE COMMENTAIRES EST ICI ! */}
                    <CommentsModal 
                        visible={showComments} 
                        onClose={() => setShowComments(false)} 
                        drawingId={selectedDrawing.id} 
                    />
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
  profileCard: { paddingHorizontal: 25, paddingTop: 20, paddingBottom: 10, backgroundColor: '#FFF' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 25 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  textsContainer: { flex: 1, justifyContent: 'center' },
  displayName: { fontSize: 26, fontWeight: '900', color: '#000', marginBottom: 8 },
  bio: { fontSize: 15, color: '#666', lineHeight: 22 },
  miniStats: { flexDirection: 'row', gap: 10 },
  miniStatText: { fontSize: 14, fontWeight: '700', color: '#000' },
  miniStatLabel: { fontWeight: '400', color: '#999' },
  divider: { width: '100%', height: 1, backgroundColor: '#F0F0F0', marginTop: 35, marginBottom: 15 },
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
  dateText: { fontSize: 14, color: '#999' },
  statsRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  statTextSmall: { fontWeight: '600', fontSize: 16 },
});