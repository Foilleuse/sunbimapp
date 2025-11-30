import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, ChevronLeft, Settings, Heart, MessageCircle, X, AlertCircle } from 'lucide-react-native'; 
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { CommentsModal } from '../../src/components/CommentsModal';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  
  // --- ETATS DONNÉES ---
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Stats
  const [totalLikes, setTotalLikes] = useState(0);
  const [drawingCount, setDrawingCount] = useState(0);

  // --- ETATS UI ---
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  // Formulaire Connexion
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const HISTORY_ITEM_SIZE = (screenWidth - 40 - 20) / 3; // 3 colonnes avec padding

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
        const { data: drawings, error } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        setHistoryItems(drawings || []);
        setDrawingCount(drawings?.length || 0);
        
        // Calcul des likes totaux
        const likes = drawings?.reduce((acc, curr) => acc + (curr.likes_count || 0), 0) || 0;
        setTotalLikes(likes);

    } catch (e) {
        console.error(e);
    } finally {
        setLoadingHistory(false);
    }
  };

  const handleAuth = async () => {
      if (!email || !password) return Alert.alert("Erreur", "Remplissez tous les champs");
      setAuthActionLoading(true);
      try {
          const { error } = isSignUp 
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });
          
          if (error) throw error;
      } catch (e: any) {
          Alert.alert("Erreur", e.message);
      } finally {
          setAuthActionLoading(false);
      }
  };

  const openDrawing = (drawing: any) => setSelectedDrawing(drawing);
  const closeDrawing = () => setSelectedDrawing(null);

  // --- VUE NON CONNECTÉ ---
  if (!user) {
      return (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
              <View style={styles.authContainer}>
                  <View style={styles.logoContainer}>
                      <Text style={styles.authTitle}>Profil</Text>
                      <Text style={styles.authSubtitle}>Connectez-vous pour retrouver vos dessins.</Text>
                  </View>

                  <View style={styles.inputGroup}>
                      <Mail color="#999" size={20} style={styles.inputIcon} />
                      <TextInput 
                        placeholder="Email" 
                        style={styles.input} 
                        placeholderTextColor="#999"
                        value={email} onChangeText={setEmail} autoCapitalize="none"
                      />
                  </View>
                  <View style={styles.inputGroup}>
                      <Lock color="#999" size={20} style={styles.inputIcon} />
                      <TextInput 
                        placeholder="Mot de passe" 
                        style={styles.input} 
                        placeholderTextColor="#999"
                        secureTextEntry
                        value={password} onChangeText={setPassword}
                      />
                  </View>

                  <TouchableOpacity style={styles.authBtn} onPress={handleAuth} disabled={authActionLoading}>
                      {authActionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.authBtnText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                      <Text style={styles.switchText}>{isSignUp ? "J'ai déjà un compte" : "Créer un compte"}</Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      );
  }

  // --- VUE CONNECTÉ ---
  return (
    <View style={styles.container}>
      {/* HEADER PROFIL */}
      <View style={styles.header}>
          <View style={styles.avatarSection}>
              {profile?.avatar_url ? (
                  <Image source={{uri: profile.avatar_url}} style={styles.profileAvatar} />
              ) : (
                  <View style={[styles.profileAvatar, styles.placeholderAvatar]}>
                      <User color="#666" size={40} />
                  </View>
              )}
              <Text style={styles.displayName}>{profile?.display_name || "Artiste"}</Text>
              <Text style={styles.email}>{user.email}</Text>
          </View>

          <View style={styles.statsBar}>
              <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{drawingCount}</Text>
                  <Text style={styles.statLabel}>Dessins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{totalLikes}</Text>
                  <Text style={styles.statLabel}>J'aime</Text>
              </View>
          </View>
          
          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
              <LogOut color="#FF3B30" size={20} />
          </TouchableOpacity>
      </View>

      {/* GRILLE HISTORIQUE */}
      <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {loadingHistory ? (
              <ActivityIndicator style={{marginTop: 20}} />
          ) : (
              <FlatList
                data={historyItems}
                numColumns={3}
                contentContainerStyle={{ paddingBottom: 100 }}
                columnWrapperStyle={{ gap: 10 }}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                    <TouchableOpacity onPress={() => openDrawing(item)} style={{ width: HISTORY_ITEM_SIZE, height: HISTORY_ITEM_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F5F5F5', marginBottom: 10 }}>
                        <DrawingViewer 
                            imageUri={item.cloud_image_url}
                            canvasData={item.canvas_data}
                            viewerSize={HISTORY_ITEM_SIZE}
                            transparentMode={false}
                            animated={false}
                            startVisible={true}
                        />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <AlertCircle color="#CCC" size={40} />
                        <Text style={styles.emptyText}>Aucun dessin pour le moment.</Text>
                    </View>
                }
              />
          )}
      </View>

      {/* MODALE DÉTAIL DESSIN */}
      <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet">
          {selectedDrawing && (
              <View style={styles.modalContainer}>
                  <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={closeDrawing} style={styles.closeModalBtn}>
                          <X color="#000" size={30} />
                      </TouchableOpacity>
                  </View>
                  
                  <Pressable 
                    onPressIn={() => setIsHolding(true)} 
                    onPressOut={() => setIsHolding(false)}
                    style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: '#F0F0F0' }}
                  >
                      <DrawingViewer 
                          imageUri={selectedDrawing.cloud_image_url}
                          canvasData={isHolding ? [] : selectedDrawing.canvas_data}
                          viewerSize={screenWidth}
                          transparentMode={true}
                          animated={true}
                          startVisible={false}
                      />
                      <Text style={styles.hintText}>Maintenir pour voir l'original</Text>
                  </Pressable>

                  <View style={styles.modalFooter}>
                      <View>
                          <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>
                          <Text style={styles.dateText}>{new Date(selectedDrawing.created_at).toLocaleDateString()}</Text>
                      </View>
                      
                      <View style={styles.statsRowSmall}>
                          <TouchableOpacity onPress={() => setIsLiked(!isLiked)}>
                              <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={28} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowComments(true)}>
                              <MessageCircle color="#000" size={28} />
                          </TouchableOpacity>
                      </View>
                  </View>

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
  authContainer: { flex: 1, justifyContent: 'center', padding: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  authTitle: { fontSize: 32, fontWeight: '900', color: '#000', marginBottom: 10 },
  authSubtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 15, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#EEE' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#000' },
  authBtn: { backgroundColor: '#000', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },
  
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  email: { fontSize: 14, color: '#999' },
  statsBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 15, paddingVertical: 15, marginHorizontal: 20 },
  statItem: { alignItems: 'center', width: 80 },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#666' },
  statDivider: { width: 1, height: 20, backgroundColor: '#DDD' },
  logoutBtn: { position: 'absolute', top: 60, right: 20, padding: 10 },
  
  historySection: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999', marginTop: 10 },
  
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, paddingTop: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeModalBtn: { padding: 5 },
  modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  drawingLabel: { fontSize: 20, fontWeight: '800', color: '#000' },
  dateText: { fontSize: 14, color: '#999' },
  statsRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
});