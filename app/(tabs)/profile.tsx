import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { User, Mail, Lock, X, Heart, MessageCircle, AlertCircle, Settings, Lightbulb, Palette, Zap, MoreHorizontal, Unlock } from 'lucide-react-native'; 
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SettingsModal } from '../../src/components/SettingsModal'; 
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  
  // États pour les réactions du dessin sélectionné
  const [userReaction, setUserReaction] = useState<ReactionType>(null);
  const [reactionCounts, setReactionCounts] = useState({
      like: 0,
      smart: 0,
      beautiful: 0,
      crazy: 0
  });

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

  // Chargement des réactions quand un dessin est ouvert
  useEffect(() => {
    if (selectedDrawing) {
        fetchReactionsState();
    }
  }, [selectedDrawing]);

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
            .select('*')
            .eq('user_id', user?.id)
            .eq('is_hidden', false);

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
      setUserReaction(null);
      setReactionCounts({ like: 0, smart: 0, beautiful: 0, crazy: 0 });
  };

  const fetchReactionsState = async () => {
        if (!selectedDrawing) return;
        try {
            const { data: allReactions, error } = await supabase
                .from('reactions')
                .select('reaction_type, user_id')
                .eq('drawing_id', selectedDrawing.id);

            if (error) throw error;

            const counts = { like: 0, smart: 0, beautiful: 0, crazy: 0 };
            let myReaction: ReactionType = null;

            allReactions?.forEach((r: any) => {
                if (counts.hasOwnProperty(r.reaction_type)) {
                    counts[r.reaction_type as keyof typeof counts]++;
                }
                if (user && r.user_id === user.id) {
                    myReaction = r.reaction_type as ReactionType;
                }
            });

            setReactionCounts(counts);
            setUserReaction(myReaction);

        } catch (e) {
            console.error("Erreur chargement réactions:", e);
        }
  };

  const handleReaction = async (type: ReactionType) => {
        if (!user || !type || !selectedDrawing) return;

        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };

        if (userReaction === type) {
            setUserReaction(null);
            setReactionCounts(prev => ({
                ...prev,
                [type]: Math.max(0, prev[type] - 1)
            }));
            
            try {
                await supabase.from('reactions').delete().eq('user_id', user.id).eq('drawing_id', selectedDrawing.id);
            } catch (e) {
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        } 
        else {
            setUserReaction(type);
            setReactionCounts(prev => {
                const newCounts = { ...prev };
                if (previousReaction) {
                    newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
                }
                newCounts[type]++;
                return newCounts;
            });

            try {
                const { error } = await supabase
                    .from('reactions')
                    .upsert({
                        user_id: user.id,
                        drawing_id: selectedDrawing.id,
                        reaction_type: type
                    }, { onConflict: 'user_id, drawing_id' });
                
                if (error) throw error;
            } catch (e) {
                console.error(e);
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        }
  };

  const handleReport = () => {
    // Sur son propre profil, on ne se signale pas soi-même, mais l'option pourrait servir pour supprimer (pas demandé ici)
    Alert.alert("Info", "Ceci est votre propre dessin.");
  };

  const profileAvatarOptimized = profile?.avatar_url ? getOptimizedImageUrl(profile.avatar_url, 100) : null;
  const selectedDrawingImageOptimized = selectedDrawing ? getOptimizedImageUrl(selectedDrawing.cloud_image_url, screenWidth) : null;

  const renderItem = ({ item }: { item: any }) => {
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

      {/* MODALE D'AGRANDISSEMENT (STYLE FEED CARD) */}
      <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDrawing}>
          {selectedDrawing && (
              <SafeAreaView style={styles.safeAreaContainer}>
                  <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={closeDrawing} style={styles.closeBtnTransparent} hitSlop={15}>
                          <X color="#000" size={28} />
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

                  {/* INFO CARD STYLE FEED */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoContent}>
                        <View style={styles.titleRow}>
                            <Text style={styles.drawingTitle} numberOfLines={1}>
                                {selectedDrawing.label || "Sans titre"}
                            </Text>
                            
                            <TouchableOpacity onPress={handleReport} style={styles.moreBtnAbsolute} hitSlop={15}>
                                <MoreHorizontal color="#CCC" size={24} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.userName}>{profile?.display_name || "Anonyme"}</Text>

                        {/* BARRE DE RÉACTIONS */}
                        <View style={styles.reactionBar}>
                            <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('like')}>
                                <Heart color={userReaction === 'like' ? "#FF3B30" : "#000"} fill={userReaction === 'like' ? "#FF3B30" : "transparent"} size={24} />
                                <Text style={[styles.reactionText, userReaction === 'like' && styles.activeText]}>{reactionCounts.like}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('smart')}>
                                <Lightbulb color={userReaction === 'smart' ? "#FFCC00" : "#000"} fill={userReaction === 'smart' ? "#FFCC00" : "transparent"} size={24} />
                                <Text style={[styles.reactionText, userReaction === 'smart' && styles.activeText]}>{reactionCounts.smart}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('beautiful')}>
                                <Palette color={userReaction === 'beautiful' ? "#5856D6" : "#000"} fill={userReaction === 'beautiful' ? "#5856D6" : "transparent"} size={24} />
                                <Text style={[styles.reactionText, userReaction === 'beautiful' && styles.activeText]}>{reactionCounts.beautiful}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('crazy')}>
                                <Zap color={userReaction === 'crazy' ? "#FF2D55" : "#000"} fill={userReaction === 'crazy' ? "#FF2D55" : "transparent"} size={24} />
                                <Text style={[styles.reactionText, userReaction === 'crazy' && styles.activeText]}>{reactionCounts.crazy}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                  </View>

              </SafeAreaView>
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
  safeAreaContainer: { flex: 1, backgroundColor: '#FFF' },
  
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

  modalHeader: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, paddingTop: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeBtnTransparent: { padding: 5, backgroundColor: 'transparent' },
  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },

  // Styles Feed Card pour l'uniformité
  infoCard: {
      width: '100%',
      padding: 20, 
      backgroundColor: '#FFF',
      borderTopWidth: 1, 
      borderTopColor: '#F0F0F0',
      marginTop: 10, 
  },
  infoContent: {
      alignItems: 'center'
  },
  titleRow: { 
      width: '100%',
      flexDirection: 'row', 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginBottom: 2,
      position: 'relative'
  },
  drawingTitle: { 
      fontSize: 26, 
      fontWeight: '900', 
      color: '#000', 
      letterSpacing: -0.5, 
      textAlign: 'center',
      maxWidth: '80%' 
  },
  moreBtnAbsolute: { 
      position: 'absolute',
      right: 0,
      top: 5,
      padding: 5 
  },
  userName: { 
      fontSize: 13, 
      fontWeight: '500', 
      color: '#888',
      marginBottom: 10
  },
  reactionBar: { 
      flexDirection: 'row', 
      justifyContent: 'space-around', 
      alignItems: 'center', 
      width: '100%',
      paddingHorizontal: 10
  },
  reactionBtn: { 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 8
  },
  reactionText: { 
      fontSize: 12, 
      fontWeight: '600', 
      color: '#999',
      marginTop: 4 
  },
  activeText: {
      color: '#000',
      fontWeight: '800'
  }
});