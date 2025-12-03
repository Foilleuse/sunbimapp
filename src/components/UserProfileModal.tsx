import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert, Pressable, Platform, SafeAreaView } from 'react-native';
import { X, User, UserPlus, UserCheck, Heart, MessageCircle } from 'lucide-react-native';
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
  
  // États pour le Follow
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // États pour l'agrandissement d'image
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // États d'interaction pour le dessin agrandi
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  // Configuration Grille
  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 2;
  const ITEM_SIZE = (screenWidth - (SPACING * (NUM_COLS - 1))) / NUM_COLS;

  useEffect(() => {
    if (visible && userId) {
        fetchUserData();
        if (currentUser && currentUser.id !== userId) {
            checkFollowStatus();
        }
    } else {
        setLoading(true);
        setDrawings([]);
        setIsFollowing(false);
        setSelectedDrawing(null); 
    }
  }, [visible, userId]);

  // Initialisation des stats quand un dessin est ouvert
  useEffect(() => {
    if (selectedDrawing && currentUser) {
        // Init du compteur
        setLikesCount(selectedDrawing.likes?.[0]?.count || selectedDrawing.likes_count || 0);
        
        // Vérifier si l'utilisateur a liké ce dessin
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

  const fetchUserData = async () => {
    try {
        setLoading(true);

        const { data: profileData, error: profileError } = await supabase
            .from('users') 
            .select('*')
            .eq('id', userId)
            .single();
        
        if (!profileError && profileData) {
            setUserProfile(profileData);
        }

        // Ajout des jointures pour les likes et commentaires
        const { data: drawingsData, error: drawingsError } = await supabase
            .from('drawings')
            .select('*, likes(count), comments(count)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (drawingsError) throw drawingsError;
        setDrawings(drawingsData || []);

    } catch (e) {
        console.error("Erreur chargement profil:", e);
    } finally {
        setLoading(false);
    }
  };

  const openDrawing = (drawing: any) => setSelectedDrawing(drawing);
  const closeDrawing = () => {
      setSelectedDrawing(null);
      setIsLiked(false);
      setShowComments(false);
  };

  const renderDrawingItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
        onPress={() => openDrawing(item)}
        style={{ width: ITEM_SIZE, aspectRatio: 3/4, marginBottom: SPACING, backgroundColor: '#F9F9F9', overflow: 'hidden' }}
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

  // Helper pour les commentaires
  const commentsCount = selectedDrawing?.comments?.[0]?.count || selectedDrawing?.comments_count || 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            {/* HEADER MODALE PRINCIPALE */}
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

                    {/* ACTIONS : Bouton Follow Carré uniquement */}
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

            {/* GALERIE */}
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

            {/* MODALE D'AGRANDISSEMENT (Style PageSheet comme demandé) */}
            <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDrawing}>
                {selectedDrawing && (
                    <SafeAreaView style={styles.safeAreaContainer}>
                        {/* Header plus compact et transparent pour l'agrandissement */}
                        {/* Réduction de paddingVertical et suppression du style.closeBtn (gris) pour un transparent */}
                        <View style={[styles.header, { paddingVertical: 0, paddingTop: 10, paddingHorizontal: 15 }]}> 
                            <TouchableOpacity onPress={closeDrawing} style={styles.closeBtnTransparent} hitSlop={15}>
                                <X color="#000" size={28} />
                            </TouchableOpacity>
                        </View>

                        {/* Contenu Centré - Utilisation de flex pour maximiser l'espace */}
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
                                        imageUri={selectedDrawing.cloud_image_url} canvasData={selectedDrawing.canvas_data}
                                        viewerSize={screenWidth} 
                                        transparentMode={true} 
                                        startVisible={false} 
                                        animated={true}
                                    />
                                </View>
                                <Text style={styles.hintText}>Maintenir pour voir l'original</Text>
                            </Pressable>
                        </View>

                         {/* Footer complet style Galerie */}
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
                                {/* Like */}
                                <TouchableOpacity style={styles.statItem} onPress={handleLike}>
                                    <Heart 
                                        color={isLiked ? "#FF3B30" : "#000"} 
                                        fill={isLiked ? "#FF3B30" : "transparent"} 
                                        size={24} 
                                    />
                                    <Text style={styles.statText}>{likesCount}</Text>
                                </TouchableOpacity>
                                
                                {/* Commentaire */}
                                <TouchableOpacity style={styles.statItem} onPress={() => setShowComments(true)}>
                                    <MessageCircle color="#000" size={24} />
                                    <Text style={styles.statText}>{commentsCount}</Text>
                                </TouchableOpacity>
                            </View>
                         </View>

                         {/* Modale Commentaires pour le dessin agrandi */}
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
  safeAreaContainer: { flex: 1, backgroundColor: '#FFF' }, // Nouveau conteneur sûr
  // Modification ici : réduction du padding vertical pour remonter le bouton
  header: { paddingHorizontal: 15, paddingVertical: 10, alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
  closeBtn: { padding: 5, backgroundColor: '#F0F0F0', borderRadius: 20 },
  // Nouveau style sans fond gris
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
  
  // Footer Style Galerie
  overlayFooter: { 
      width: '100%',
      padding: 20, 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      borderTopWidth: 1, 
      borderTopColor: '#F0F0F0', 
      marginTop: 10, // Réduit la marge pour coller au contenu
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