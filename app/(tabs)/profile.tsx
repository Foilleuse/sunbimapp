import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { User, Mail, Lock, X, Heart, MessageCircle, AlertCircle, Settings } from 'lucide-react-native'; 
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { CommentsModal } from '../../src/components/CommentsModal';
import { SettingsModal } from '../../src/components/SettingsModal'; 
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 2; 
  const ITEM_SIZE = (screenWidth - (SPACING * (NUM_COLS - 1))) / NUM_COLS;

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  useEffect(() => {
    if (selectedDrawing && user) {
        setLikesCount(selectedDrawing.likes?.[0]?.count || selectedDrawing.likes_count || 0);
        
        const checkLikeStatus = async () => {
            const { count } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('drawing_id', selectedDrawing.id);
            
            setIsLiked(count !== null && count > 0);
        };
        checkLikeStatus();
    }
  }, [selectedDrawing, user]);

  const fetchHistory = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: allClouds, error: cloudsError } = await supabase
            .from('clouds')
            .select('*')
            .lte('published_for', today)
            .order('published_for', { ascending: false });

        if (cloudsError) throw cloudsError;

        const { data: userDrawings, error: drawingsError } = await supabase
            .from('drawings')
            .select('*, likes(count), comments(count)')
            .eq('user_id', user?.id);

        if (drawingsError) throw drawingsError;

        const combinedHistory = allClouds?.map(cloud => {
            const drawing = userDrawings?.find(d => d.cloud_id === cloud.id);
            if (drawing) {
                return { ...drawing, type: 'drawing', id: drawing.id }; 
            } else {
                return { 
                    id: `missed-${cloud.id}`, 
                    type: 'missed', 
                    cloud_image_url: cloud.image_url, 
                    date: cloud.published_for 
                };
            }
        }) || [];

        setHistoryItems(combinedHistory);

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
  const closeDrawing = () => {
      setSelectedDrawing(null);
      setIsLiked(false);
      setShowComments(false);
  };

  const handleLike = async () => {
    if (!user || !selectedDrawing) return;

    const previousLiked = isLiked;
    const previousCount = likesCount;

    const newLikedState = !previousLiked;
    const newCount = newLikedState ? previousCount + 1 : Math.max(0, previousCount - 1);

    setIsLiked(newLikedState);
    setLikesCount(newCount);

    try {
        if (previousLiked) {
            const { error } = await supabase
                .from('likes')
                .delete()
                .eq('user_id', user.id)
                .eq('drawing_id', selectedDrawing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('likes')
                .insert({
                    user_id: user.id,
                    drawing_id: selectedDrawing.id
                });
            if (error) throw error;
        }
    } catch (error) {
        console.error("Erreur like:", error);
        setIsLiked(previousLiked);
        setLikesCount(previousCount);
    }
  };

  const commentsCount = selectedDrawing?.comments?.[0]?.count || selectedDrawing?.comments_count || 0;

  // Optimisation de l'avatar pour l'affichage principal (taille ~100px)
  const profileAvatarOptimized = profile?.avatar_url ? getOptimizedImageUrl(profile.avatar_url, 100) : null;
  
  // Optimisation de l'image agrandie (pleine largeur)
  const selectedDrawingImageOptimized = selectedDrawing ? getOptimizedImageUrl(selectedDrawing.cloud_image_url, screenWidth) : null;

  const renderItem = ({ item }: { item: any }) => {
      // Optimisation de la miniature (taille de la colonne)
      const thumbOptimized = getOptimizedImageUrl(item.cloud_image_url, ITEM_SIZE);

      if (item.type === 'missed') {
          return (
            <View style={{ width: ITEM_SIZE, aspectRatio: 3/4, marginBottom: SPACING, backgroundColor: '#EEE', position: 'relative' }}>
                <Image 
                    source={{ uri: thumbOptimized || item.cloud_image_url }} 
                    style={{ width: '100%', height: '100%', opacity: 0.6 }} 
                    resizeMode="cover" 
                />
                <View style={styles.missedOverlay}>
                    <AlertCircle color="#000" size={32} style={{ marginBottom: 5 }} />
                    <Text style={styles.missedDate}>
                        {new Date(item.date).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                    </Text>
                </View>
            </View>
          );
      }

      return (
        <TouchableOpacity 
            onPress={() => openDrawing(item)} 
            style={{ 
                width: ITEM_SIZE, 
                aspectRatio: 3/4, 
                marginBottom: SPACING, 
                backgroundColor: '#F9F9F9', 
                overflow: 'hidden' 
            }}
        >
            <DrawingViewer 
                imageUri={item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                transparentMode={false}
                animated={false}
                startVisible={true}
            />
        </TouchableOpacity>
      );
  };

  if (!user) {
      return (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
              <SunbimHeader showCloseButton={false} />
              
              <View style={styles.authContainer}>
                  <View style={styles.logoContainer}>
                      <Text style={styles.authTitle}>Profil</Text>
                      <Text style={styles.authSubtitle}>Connectez-vous pour retrouver vos dessins.</Text>
                  </View>
                  <View style={styles.inputGroup}>
                      <Mail color="#999" size={20} style={styles.inputIcon} />
                      <TextInput placeholder="Email" style={styles.input} placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" />
                  </View>
                  <View style={styles.inputGroup}>
                      <Lock color="#999" size={20} style={styles.inputIcon} />
                      <TextInput placeholder="Mot de passe" style={styles.input} placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} />
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

  return (
    <View style={styles.container}>
      <SunbimHeader showCloseButton={false} />

      <View style={styles.profileBlock}>
          <View style={styles.profileInfoContainer}>
              {profile?.avatar_url ? (
                  <Image 
                    source={{ uri: profileAvatarOptimized || profile.avatar_url }} 
                    style={styles.profileAvatar} 
                  />
              ) : (
                  <View style={[styles.profileAvatar, styles.placeholderAvatar]}>
                      <User color="#666" size={35} />
                  </View>
              )}
              
              <View style={styles.profileTextContainer}>
                  <Text style={styles.displayName}>{profile?.display_name || "Anonyme"}</Text>
                  <Text style={styles.bio} numberOfLines={3}>
                      {profile?.bio || "Aucune bio pour le moment."}
                  </Text>
              </View>

              {/* BOUTON PARAMÈTRES (LOGO SEULEMENT) */}
              <View style={{ marginLeft: 10 }}>
                 <TouchableOpacity 
                    style={styles.iconOnlyBtn} 
                    onPress={() => setShowSettings(true)}
                  >
                      <Settings color="#000" size={20} />
                  </TouchableOpacity>
              </View>
          </View>
      </View>

      <View style={styles.historySection}>
          {loadingHistory ? (
              <ActivityIndicator style={{marginTop: 20}} />
          ) : (
              <FlatList
                data={historyItems}
                numColumns={NUM_COLS}
                contentContainerStyle={{ paddingBottom: 100 }}
                columnWrapperStyle={{ gap: SPACING }}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <AlertCircle color="#CCC" size={40} />
                        <Text style={styles.emptyText}>Aucune activité pour le moment.</Text>
                    </View>
                }
              />
          )}
      </View>

      <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDrawing}>
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
                      <Image 
                            source={{ uri: selectedDrawingImageOptimized || selectedDrawing.cloud_image_url }}
                            style={[StyleSheet.absoluteFill, { opacity: 1 }]}
                            resizeMode="cover"
                        />
                      <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                        <DrawingViewer 
                            imageUri={selectedDrawing.cloud_image_url}
                            canvasData={selectedDrawing.canvas_data}
                            viewerSize={screenWidth}
                            transparentMode={true}
                            animated={true}
                            startVisible={false}
                        />
                      </View>
                      <Text style={styles.hintText}>Maintenir pour voir l'original</Text>
                  </Pressable>

                  <View style={styles.modalFooter}>
                      <View style={styles.userInfoRow}>
                        {/* Optimisation de l'avatar dans le footer (petit format) */}
                        <View style={styles.profilePlaceholder}>
                            {profile?.avatar_url ? (
                                <Image 
                                    source={{ uri: getOptimizedImageUrl(profile.avatar_url, 50) || profile.avatar_url }} 
                                    style={{width:40, height:40, borderRadius:20}} 
                                />
                            ) : (
                                <User color="#FFF" size={20} />
                            )}
                        </View>
                        <View>
                            <Text style={styles.userName}>{profile?.display_name || "Anonyme"}</Text>
                            <Text style={styles.drawingLabel}>{selectedDrawing.label || "Sans titre"}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.statsRowSmall}>
                          <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', gap: 4}} onPress={handleLike}>
                              <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={28} />
                              <Text style={{fontWeight: '600', fontSize: 16, color: '#000'}}>{likesCount}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', gap: 4}} onPress={() => setShowComments(true)}>
                              <MessageCircle color="#000" size={28} />
                              <Text style={{fontWeight: '600', fontSize: 16, color: '#000'}}>{commentsCount}</Text>
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

      <SettingsModal 
        visible={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  
  profileBlock: { 
      paddingTop: 10, 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#FFF'
  },
  
  profileInfoContainer: {
      flexDirection: 'row', 
      alignItems: 'center',
      marginBottom: 20,
  },
  profileAvatar: { 
      width: 80, 
      height: 80, 
      borderRadius: 40,
      marginRight: 15 
  },
  placeholderAvatar: { 
      backgroundColor: '#F0F0F0', 
      justifyContent: 'center', 
      alignItems: 'center' 
  },
  profileTextContainer: {
      flex: 1,
      justifyContent: 'center'
  },
  displayName: { 
      fontSize: 22, 
      fontWeight: '900', 
      color: '#000',
      marginBottom: 4
  },
  bio: { 
      fontSize: 14, 
      color: '#666',
      lineHeight: 20
  },

  iconOnlyBtn: {
      width: 44, 
      height: 44, 
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F5',
      borderRadius: 12,
  },
  
  historySection: { flex: 1, paddingTop: 15 },
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999', marginTop: 10 },
  
  missedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)' },
  missedDate: { fontSize: 16, fontWeight: '700', color: '#000', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },

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

  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, paddingTop: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeModalBtn: { padding: 5 },
  modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  drawingLabel: { fontSize: 16, color: '#666', marginTop: 2 },
  dateText: { fontSize: 14, color: '#999' },
  statsRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
  
  userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', overflow:'hidden' },
  userName: { fontWeight: '700', fontSize: 14, color: '#000' },
});