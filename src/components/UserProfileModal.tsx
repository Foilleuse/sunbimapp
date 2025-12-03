import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert, Pressable } from 'react-native';
import { X, User, UserPlus, UserCheck, Heart, MessageCircle } from 'lucide-react-native'; // Ajout icônes manquantes si besoin
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';
import { useAuth } from '../contexts/AuthContext';
import { CommentsModal } from './CommentsModal'; // Pour pouvoir voir les commentaires du dessin agrandi si on veut

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
  const [showComments, setShowComments] = useState(false); // Optionnel : si on veut commenter le dessin agrandi

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
        setSelectedDrawing(null); // Reset sélection
    }
  }, [visible, userId]);

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

        // On récupère aussi les likes/comments count pour l'affichage agrandi
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            {/* HEADER MODALE */}
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

                    {/* ACTIONS (Maintenant à côté du texte, ou en colonne selon la place) */}
                    {/* Pour garder le layout demandé : Avatar gauche, Texte milieu, Actions droite (si possible) ou en dessous */}
                    {/* Le layout actuel 'profileInfoContainer' est 'row'. On peut ajouter les actions à la fin de cette row */}
                    {currentUser && currentUser.id !== userId && (
                        <View style={{ marginLeft: 10 }}>
                             <TouchableOpacity 
                                style={[styles.iconOnlyBtn, isFollowing && styles.followingBtn]} 
                                onPress={toggleFollow}
                                disabled={followLoading}
                            >
                                {followLoading ? (
                                    <ActivityIndicator color={isFollowing ? "#000" : "#000"} size="small" />
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

            {/* MODALE D'AGRANDISSEMENT (Interne) */}
            <Modal visible={!!selectedDrawing} animationType="fade" transparent={true} onRequestClose={closeDrawing}>
                {selectedDrawing && (
                    <View style={styles.fullScreenOverlay}>
                        <TouchableOpacity style={styles.closeOverlayBtn} onPress={closeDrawing}>
                            <X color="#000" size={30} />
                        </TouchableOpacity>

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

                         {/* Footer minimaliste pour le dessin agrandi */}
                         <View style={styles.overlayFooter}>
                            <Text style={styles.overlayLabel}>{selectedDrawing.label || "Sans titre"}</Text>
                            <Text style={styles.overlayDate}>{new Date(selectedDrawing.created_at).toLocaleDateString()}</Text>
                         </View>
                    </View>
                )}
            </Modal>

        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 15, alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
  closeBtn: { padding: 5, backgroundColor: '#F0F0F0', borderRadius: 20 },
  
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

  // Bouton carré simple
  iconOnlyBtn: {
      width: 44, 
      height: 44, 
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EEE', // Gris clair par défaut (Non suivi)
      borderRadius: 12,
  },
  followingBtn: {
      backgroundColor: '#FFF', // Fond blanc si suivi
      borderWidth: 2,
      borderColor: '#000'
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 },

  // Styles Overlay Agrandissement
  fullScreenOverlay: { 
      flex: 1, 
      backgroundColor: 'rgba(255,255,255,0.98)', 
      justifyContent: 'center', 
      alignItems: 'center' 
  },
  closeOverlayBtn: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      padding: 10,
      backgroundColor: '#FFF',
      borderRadius: 25,
      shadowColor: "#000", shadowOffset: {width:0, height:2}, shadowOpacity:0.1, shadowRadius:4
  },
  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
  overlayFooter: {
      marginTop: 20,
      alignItems: 'center'
  },
  overlayLabel: { fontSize: 22, fontWeight: '800', color: '#000' },
  overlayDate: { fontSize: 14, color: '#999', marginTop: 5 }
});