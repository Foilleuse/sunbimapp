import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert, Pressable, Platform, SafeAreaView } from 'react-native';
import { X, User, UserPlus, UserCheck, Heart, MessageCircle } from 'lucide-react-native'; // Lock supprimé car plus d'écran verrouillé global
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';
import { useAuth } from '../contexts/AuthContext';
import { CommentsModal } from './CommentsModal';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialUser?: any; 
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, userId, initialUser }) => {
  const { user: currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(initialUser || null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // NOUVEAU : Liste des ID de nuages que l'utilisateur courant a "débloqués" (en participant)
  const [unlockedCloudIds, setUnlockedCloudIds] = useState<string[]>([]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 2;
  const ITEM_SIZE = (screenWidth - (SPACING * (NUM_COLS - 1))) / NUM_COLS;

  useEffect(() => {
    let isMounted = true;

    const initModal = async () => {
        if (visible && userId) {
            if (isMounted) {
                setLoading(true);
                setDrawings([]);
                setUnlockedCloudIds([]);
            }

            if (currentUser && currentUser.id !== userId) {
                checkFollowStatus();
            }
            await fetchData(isMounted);
        } else {
            if (isMounted) {
                setLoading(true);
                setDrawings([]);
                setIsFollowing(false);
                setSelectedDrawing(null); 
                setUnlockedCloudIds([]);
            }
        }
    };

    initModal();

    return () => { isMounted = false; };
  }, [visible, userId, currentUser]);

  // Initialisation des stats quand un dessin est ouvert
  useEffect(() => {
    if (selectedDrawing && currentUser) {
        setLikesCount(selectedDrawing.likes?.[0]?.count || selectedDrawing.likes_count || 0);
        
        const checkLikeStatus = async () => {
            const { count } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('drawing_id', selectedDrawing.id);
            
            setIsLiked(count !== null && count > 0);
        };
        checkLikeStatus();
    }
  }, [selectedDrawing, currentUser]);

  const checkFollowStatus = async () => {
      try {
          const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', currentUser?.id)
            .eq('following_id', userId);
          
          setIsFollowing(count !== null && count > 0);
      } catch (e) {
          console.error("Erreur check follow:", e);
      }
  };

  const toggleFollow = async () => {
      if (!currentUser) return;
      setFollowLoading(true);
      try {
          if (isFollowing) {
              const { error } = await supabase
                .from('follows')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId);
              if (error) throw error;
              setIsFollowing(false);
          } else {
              const { error } = await supabase
                .from('follows')
                .insert({
                    follower_id: currentUser.id,
                    following_id: userId
                });
              if (error) throw error;
              setIsFollowing(true);
          }
      } catch (e: any) {
          Alert.alert("Erreur", "Impossible de modifier l'abonnement.");
          console.error(e);
      } finally {
          setFollowLoading(false);
      }
  };

  const handleLike = async () => {
    if (!currentUser || !selectedDrawing) return;

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
                .eq('user_id', currentUser.id)
                .eq('drawing_id', selectedDrawing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('likes')
                .insert({
                    user_id: currentUser.id,
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

  // Nouvelle fonction unifiée pour tout charger
  const fetchData = async (isMounted: boolean) => {
    try {
        // 1. Profil Utilisateur
        const { data: profileData } = await supabase
            .from('users') 
            .select('*')
            .eq('id', userId)
            .single();
        
        if (isMounted && profileData) setUserProfile(profileData);

        // 2. Dessins de l'utilisateur CIBLÉ
        const { data: drawingsData, error: drawingsError } = await supabase
            .from('drawings')
            .select('*, likes(count), comments(count)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (drawingsError) throw drawingsError;
        if (isMounted) setDrawings(drawingsData || []);

        // 3. Récupérer les participations de l'utilisateur COURANT (pour savoir ce qu'il a le droit de voir)
        if (currentUser) {
            // On récupère tous les cloud_id où j'ai dessiné
            const { data: myDrawings } = await supabase
                .from('drawings')
                .select('cloud_id')
                .eq('user_id', currentUser.id);
            
            if (isMounted && myDrawings) {
                // On crée une liste simple d'IDs
                const myCloudIds = myDrawings.map(d => d.cloud_id);
                setUnlockedCloudIds(myCloudIds);
            }
        }

    } catch (e) {
        console.error("Erreur chargement données profil:", e);
    } finally {
        if (isMounted) setLoading(false);
    }
  };

  const openDrawing = (drawing: any) => setSelectedDrawing(drawing);
  const closeDrawing = () => {
      setSelectedDrawing(null);
      setIsLiked(false);
      setShowComments(false);
  };

  const renderDrawingItem = ({ item }: { item: any }) => {
    // CONDITION D'AFFICHAGE DU DESSIN :
    // 1. C'est mon propre profil (je vois tout)
    // 2. OU j'ai dessiné sur ce nuage (cloud_id présent dans ma liste unlockedCloudIds)
    const isUnlocked = (currentUser?.id === userId) || unlockedCloudIds.includes(item.cloud_id);

    return (
        <TouchableOpacity 
            onPress={() => openDrawing(item)}
            style={{ width: ITEM_SIZE, aspectRatio: 3/4, marginBottom: SPACING, backgroundColor: '#F9F9F9', overflow: 'hidden' }}
        >
            <DrawingViewer 
                imageUri={item.cloud_image_url}
                // Si pas débloqué, on passe un tableau vide -> Affiche juste le nuage (photo sans dessin)
                canvasData={isUnlocked ? item.canvas_data : []}
                viewerSize={ITEM_SIZE}
                transparentMode={false}
                animated={false}
                startVisible={true}
            />
        </TouchableOpacity>
    );
  };

  const commentsCount = selectedDrawing?.comments?.[0]?.count || selectedDrawing?.comments_count || 0;
  
  // Vérification unlock pour le dessin sélectionné (agrandi)
  const isSelectedUnlocked = selectedDrawing && (
      (currentUser?.id === userId) || unlockedCloudIds.includes(selectedDrawing.cloud_id)
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={15}>
                    <X color="#000" size={28} />
                </TouchableOpacity>
            </View>

            {/* INFO UTILISATEUR */}
            <View style={styles.profileBlock}>
                <View style={styles.profileInfoContainer}>
                    {userProfile?.avatar_url ? (
                        <Image source={{ uri: userProfile.avatar_url }} style={styles.profileAvatar} />
                    ) : (
                        <View style={[styles.profileAvatar, styles.placeholderAvatar]}>
                            <User size={35} color="#666" />
                        </View>
                    )}
                    
                    <View style={styles.profileTextContainer}>
                        <Text style={styles.displayName}>{userProfile?.display_name || "Utilisateur"}</Text>
                        <Text style={styles.bio} numberOfLines={3}>
                            {userProfile?.bio || "Aucune bio renseignée."}
                        </Text>
                    </View>

                    {currentUser && currentUser.id !== userId && (
                        <View style={{ marginLeft: 10 }}>
                             <TouchableOpacity 
                                style={[styles.iconOnlyBtn, isFollowing && styles.followingBtn]} 
                                onPress={toggleFollow}
                                disabled={followLoading}
                            >
                                {followLoading ? (
                                    <ActivityIndicator color="#000" size="small" />
                                ) : (
                                    isFollowing ? <UserCheck color="#000" size={20} /> : <UserPlus color="#000" size={20} />
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* GALERIE (Toujours affichée, mais contenu filtré via renderDrawingItem) */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                </View>
            ) : (
                <FlatList
                    data={drawings}
                    renderItem={renderDrawingItem}
                    keyExtractor={(item) => item.id}
                    numColumns={NUM_COLS}
                    columnWrapperStyle={{ gap: SPACING }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <User color="#CCC" size={32} />
                            <Text style={styles.emptyText}>Aucun dessin publié.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}

            {/* MODALE D'AGRANDISSEMENT */}
            <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDrawing}>
                {selectedDrawing && (
                    <SafeAreaView style={styles.safeAreaContainer}>
                        <View style={[styles.header, { paddingVertical: 0, paddingTop: 10, paddingHorizontal: 15 }]}> 
                            <TouchableOpacity onPress={closeDrawing} style={styles.closeBtnTransparent} hitSlop={15}>
                                <X color="#000" size={28} />
                            </TouchableOpacity>
                        </View>

                        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}> 
                            <Pressable 
                                onPressIn={() => setIsHolding(true)} 
                                onPressOut={() => setIsHolding(false)}
                                style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: '#F0F0F0' }}
                            >
                                <Image 
                                    source={{ uri: selectedDrawing.cloud_image_url }}
                                    style={[StyleSheet.absoluteFill, { opacity: 1 }]}
                                    resizeMode="cover"
                                />
                                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                                    <DrawingViewer
                                        imageUri={selectedDrawing.cloud_image_url} 
                                        // Si pas débloqué, tableau vide -> photo sans dessin
                                        canvasData={isSelectedUnlocked ? selectedDrawing.canvas_data : []}
                                        viewerSize={screenWidth} 
                                        transparentMode={true} 
                                        startVisible={false} 
                                        animated={true}
                                    />
                                </View>
                                {isSelectedUnlocked && <Text style={styles.hintText}>Maintenir pour voir l'original</Text>}
                            </Pressable>
                        </View>

                         <View style={styles.overlayFooter}>
                            <View style={styles.userInfoRow}>
                                <View style={styles.profilePlaceholder}>
                                    {userProfile?.avatar_url ? (
                                        <Image source={{uri: userProfile.avatar_url}} style={{width:40, height:40, borderRadius:20}} />
                                    ) : (
                                        <User color="#FFF" size={20} />
                                    )}
                                </View>
                                <View>
                                    <Text style={styles.userName}>{userProfile?.display_name || "Anonyme"}</Text>
                                    {selectedDrawing.label && <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>}
                                </View>
                            </View>

                            <View style={styles.statsRow}>
                                <TouchableOpacity style={styles.statItem} onPress={handleLike}>
                                    <Heart 
                                        color={isLiked ? "#FF3B30" : "#000"} 
                                        fill={isLiked ? "#FF3B30" : "transparent"} 
                                        size={24} 
                                    />
                                    <Text style={styles.statText}>{likesCount}</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity style={styles.statItem} onPress={() => setShowComments(true)}>
                                    <MessageCircle color="#000" size={24} />
                                    <Text style={styles.statText}>{commentsCount}</Text>
                                </TouchableOpacity>
                            </View>
                         </View>

                         <CommentsModal 
                            visible={showComments} 
                            onClose={() => setShowComments(false)} 
                            drawingId={selectedDrawing.id} 
                        />
                    </SafeAreaView>
                )}
            </Modal>

        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  safeAreaContainer: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingHorizontal: 15, paddingVertical: 10, alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
  closeBtn: { padding: 5, backgroundColor: '#F0F0F0', borderRadius: 20 },
  closeBtnTransparent: { padding: 5, backgroundColor: 'transparent' },
  
  profileBlock: { 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#FFF'
  },
  profileInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
  },
  profileAvatar: { 
      width: 70, 
      height: 70, 
      borderRadius: 35,
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
      fontSize: 20, 
      fontWeight: '900', 
      color: '#000',
      marginBottom: 4
  },
  bio: { 
      fontSize: 13, 
      color: '#666',
      lineHeight: 18
  },

  iconOnlyBtn: {
      width: 44, 
      height: 44, 
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EEE', 
      borderRadius: 12,
  },
  followingBtn: {
      backgroundColor: '#FFF', 
      borderWidth: 2,
      borderColor: '#000'
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 },

  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
  
  overlayFooter: { 
      width: '100%',
      padding: 20, 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      borderTopWidth: 1, 
      borderTopColor: '#F0F0F0', 
      marginTop: 10, 
      backgroundColor: '#FFF'
  },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', overflow:'hidden' },
  userName: { fontWeight: '700', fontSize: 14, color: '#000' },
  drawingLabel: { color: '#666', fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 15 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontWeight: '600', fontSize: 16, color: '#000' },
});