import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert, Pressable, Platform, SafeAreaView, PixelRatio, ScrollView } from 'react-native';
import { X, User, UserPlus, UserCheck, Heart, MessageCircle, Lock, AlertCircle, Unlock, Lightbulb, Palette, Zap, MoreHorizontal } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';
import { useAuth } from '../contexts/AuthContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
// Import du nouveau composant
import { DrawingDetailModal } from './DrawingDetailModal';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialUser?: any; 
}

// --- COMPOSANT MÉMORISÉ POUR LA GRILLE ---
const DrawingGridItem = memo(({ item, size, isUnlocked, onPress, spacing }: any) => {
    const optimizedGridUri = useMemo(() => {
        if (!item.cloud_image_url) return null;
        const w = Math.round(size * PixelRatio.get());
        const h = Math.round(w * (4/3)); 
        return getOptimizedImageUrl(item.cloud_image_url, w, h);
    }, [item.cloud_image_url, size]);

    return (
        <TouchableOpacity 
            onPress={() => {
                if (isUnlocked) {
                    onPress(item);
                } else {
                    Alert.alert("Jour manqué", "Vous n'avez pas dessiné ce jour-là.");
                }
            }}
            activeOpacity={0.7}
            style={{ width: size, aspectRatio: 3/4, marginBottom: spacing, backgroundColor: '#F9F9F9', overflow: 'hidden', position: 'relative' }}
        >
            <DrawingViewer 
                imageUri={optimizedGridUri || item.cloud_image_url}
                canvasData={isUnlocked ? item.canvas_data : []}
                viewerSize={size}
                viewerHeight={size * (4/3)} 
                transparentMode={false}
                animated={false}
                startVisible={true}
                autoCenter={false} 
            />
            {!isUnlocked && (
                <View style={styles.missedOverlay}>
                    <AlertCircle color="#000" size={32} style={{ marginBottom: 5 }} />
                    <Text style={styles.missedDate}>
                        {new Date(item.created_at).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}, (prev, next) => {
    return prev.item.id === next.item.id && prev.isUnlocked === next.isUnlocked && prev.size === next.size;
});

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, userId, initialUser }) => {
  const { user: currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(initialUser || null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [unlockedCloudIds, setUnlockedCloudIds] = useState<string[]>([]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // État pour la modale de détail
  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);

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
                setIsBlocked(false);
            }

            if (currentUser && currentUser.id !== userId) {
                checkFollowStatus();
                checkBlockStatus();
            }
            await fetchData(isMounted);
        } else {
            if (isMounted) {
                setLoading(true);
                setDrawings([]);
                setIsFollowing(false);
                setIsBlocked(false);
                setSelectedDrawing(null); 
                setUnlockedCloudIds([]);
            }
        }
    };

    initModal();

    return () => { isMounted = false; };
  }, [visible, userId, currentUser]);

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

  const checkBlockStatus = async () => {
      try {
          const { count } = await supabase
            .from('blocks')
            .select('*', { count: 'exact', head: true })
            .eq('blocker_id', currentUser?.id)
            .eq('blocked_id', userId);
          
          setIsBlocked(count !== null && count > 0);
      } catch (e) {
          console.error("Erreur check block:", e);
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

  const handleUnblock = async () => {
      if (!currentUser) return;
      setFollowLoading(true);
      try {
          const { error } = await supabase
            .from('blocks')
            .delete()
            .eq('blocker_id', currentUser.id)
            .eq('blocked_id', userId);
          
          if (error) throw error;
          
          setIsBlocked(false);
          Alert.alert("Utilisateur débloqué", "Vous pouvez maintenant voir son contenu.");
          fetchData(true);
      } catch (e: any) {
          Alert.alert("Erreur", "Impossible de débloquer.");
          console.error(e);
      } finally {
          setFollowLoading(false);
      }
  };

  const fetchData = async (isMounted: boolean) => {
    try {
        const { data: profileData } = await supabase
            .from('users') 
            .select('*')
            .eq('id', userId)
            .single();
        
        if (isMounted && profileData) setUserProfile(profileData);

        // --- MODIFICATION : Récupération des reports pour filtrage simple ---
        const { data: drawingsData, error: drawingsError } = await supabase
            .from('drawings')
            .select('*, reports(id)') 
            .eq('user_id', userId)
            // On NE filtre PAS sur is_hidden dans la requête SQL
            .order('created_at', { ascending: false });

        if (drawingsError) throw drawingsError;

        // --- LOGIQUE DE FILTRAGE ULTRA SIMPLE ---
        // Si nombre de signalements >= 2, on masque. Sinon on affiche.
        const safeDrawings = (drawingsData || []).filter((drawing: any) => {
            const reportCount = drawing.reports ? drawing.reports.length : 0;
            return reportCount < 2;
        });

        if (isMounted) setDrawings(safeDrawings);

        if (currentUser) {
            const { data: myDrawings } = await supabase
                .from('drawings')
                .select('cloud_id')
                .eq('user_id', currentUser.id);
            
            if (isMounted && myDrawings) {
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

  const openDrawing = useCallback((drawing: any) => setSelectedDrawing(drawing), []);
  
  const closeDrawing = () => {
      setSelectedDrawing(null);
  };

  const renderDrawingItem = useCallback(({ item }: { item: any }) => {
    const isUnlocked = (currentUser?.id === userId) || unlockedCloudIds.includes(item.cloud_id);

    return (
        <DrawingGridItem 
            item={item}
            size={ITEM_SIZE}
            spacing={SPACING}
            isUnlocked={isUnlocked}
            onPress={openDrawing}
        />
    );
  }, [currentUser, userId, unlockedCloudIds, ITEM_SIZE, SPACING, openDrawing]);
  
  const isSelectedUnlocked = selectedDrawing && (
      (currentUser?.id === userId) || unlockedCloudIds.includes(selectedDrawing.cloud_id)
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={15}>
                    <X color="#000" size={28} />
                </TouchableOpacity>
            </View>

            <View style={styles.profileBlock}>
                <View style={styles.profileInfoContainer}>
                    {userProfile?.avatar_url ? (
                        <Image 
                            source={{ uri: userProfile.avatar_url }} 
                            style={styles.profileAvatar} 
                        />
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
                             {isBlocked ? (
                                <TouchableOpacity 
                                    style={[styles.iconOnlyBtn, styles.unblockBtn]} 
                                    onPress={handleUnblock}
                                    disabled={followLoading}
                                >
                                    {followLoading ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Unlock color="#FFF" size={20} />
                                    )}
                                </TouchableOpacity>
                             ) : (
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
                             )}
                        </View>
                    )}
                </View>
            </View>

            {isBlocked ? (
                <View style={styles.blockedState}>
                    <Lock color="#CCC" size={40} />
                    <Text style={styles.emptyText}>Vous avez bloqué cet utilisateur.</Text>
                    <Text style={styles.blockedSubText}>Débloquez-le pour voir ses dessins.</Text>
                </View>
            ) : (
                loading ? (
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
                )
            )}

            {/* NOUVELLE MODALE DE DÉTAIL */}
            {selectedDrawing && (
                <DrawingDetailModal
                    visible={!!selectedDrawing}
                    onClose={closeDrawing}
                    drawing={selectedDrawing}
                    userProfile={userProfile} // On passe le profil chargé ici
                    isUnlocked={isSelectedUnlocked}
                />
            )}

        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingHorizontal: 15, paddingVertical: 10, alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
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
  unblockBtn: {
      backgroundColor: '#FF3B30', 
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 },
  
  blockedState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: -50 
  },
  blockedSubText: {
      color: '#666',
      fontSize: 14,
  },

  missedOverlay: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: 'rgba(255,255,255,0.4)' 
  },
  missedDate: { 
      fontSize: 16, 
      fontWeight: '700', 
      color: '#000', 
      backgroundColor: 'rgba(255,255,255,0.8)', 
      paddingHorizontal: 8, 
      paddingVertical: 2, 
      borderRadius: 4, 
      overflow: 'hidden' 
  },
});