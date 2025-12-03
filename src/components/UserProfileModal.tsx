import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { X, User, UserPlus, UserCheck, MessageCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';
import { useAuth } from '../contexts/AuthContext';

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

  // Configuration Grille (Identique à profile.tsx)
  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 2; // Passage à 2 colonnes
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
              // Unfollow
              const { error } = await supabase
                .from('follows')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId);
              if (error) throw error;
              setIsFollowing(false);
          } else {
              // Follow
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

        const { data: drawingsData, error: drawingsError } = await supabase
            .from('drawings')
            .select('*')
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

  const renderDrawingItem = ({ item }: { item: any }) => (
    <View style={{ width: ITEM_SIZE, aspectRatio: 3/4, marginBottom: SPACING, backgroundColor: '#F9F9F9', overflow: 'hidden' }}>
        <DrawingViewer 
            imageUri={item.cloud_image_url}
            canvasData={item.canvas_data}
            viewerSize={ITEM_SIZE}
            transparentMode={false}
            animated={false}
            startVisible={true}
        />
    </View>
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

            {/* INFO UTILISATEUR (Style identique à profile.tsx) */}
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
                </View>

                {/* BARRE D'ACTIONS */}
                {currentUser && currentUser.id !== userId && (
                    <View style={styles.profileActions}>
                        {/* BOUTON FOLLOW */}
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.primaryBtn, isFollowing && styles.followingBtn]} 
                            onPress={toggleFollow}
                            disabled={followLoading}
                        >
                            {followLoading ? (
                                <ActivityIndicator color={isFollowing ? "#000" : "#FFF"} size="small" />
                            ) : (
                                <>
                                    {isFollowing ? <UserCheck color="#000" size={18} /> : <UserPlus color="#FFF" size={18} />}
                                    <Text style={[styles.actionButtonText, isFollowing && styles.followingText]}>
                                        {isFollowing ? "Suivi" : "Suivre"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* BOUTON MESSAGE (Visuel uniquement pour l'instant) */}
                        <TouchableOpacity style={styles.iconOnlyBtn} onPress={() => Alert.alert("Message", "Fonctionnalité à venir")}>
                            <MessageCircle color="#000" size={20} />
                        </TouchableOpacity>
                    </View>
                )}
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
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 15, alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, // Header minimaliste
  closeBtn: { padding: 5, backgroundColor: '#F0F0F0', borderRadius: 20 },
  
  // BLOC PROFIL (Repris de profile.tsx)
  profileBlock: { 
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

  // ACTIONS
  profileActions: {
      flexDirection: 'row',
      gap: 10,
  },
  actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000', // Noir par défaut (Suivre)
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6
  },
  primaryBtn: {
      flex: 1, 
  },
  followingBtn: {
      backgroundColor: '#F0F0F0', // Gris si déjà suivi
      borderWidth: 1,
      borderColor: '#DDD'
  },
  actionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFF'
  },
  followingText: {
      color: '#000'
  },
  iconOnlyBtn: {
      width: 45, 
      height: 45, 
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F5',
      borderRadius: 10,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 }
});