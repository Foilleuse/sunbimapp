import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { X, User, AlertCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialUser?: any; // Données partielles (nom, avatar) pour affichage immédiat
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, userId, initialUser }) => {
  const [userProfile, setUserProfile] = useState<any>(initialUser || null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 3; 
  const ITEM_SIZE = (screenWidth - (SPACING * (NUM_COLS - 1))) / NUM_COLS;

  useEffect(() => {
    if (visible && userId) {
        fetchUserData();
    } else {
        // Reset states on close
        setLoading(true);
        setDrawings([]);
    }
  }, [visible, userId]);

  const fetchUserData = async () => {
    try {
        setLoading(true);

        // 1. Récupérer le profil complet (pour la bio par exemple)
        // On suppose que la table 'profiles' ou 'users' est accessible publiquement en lecture
        const { data: profileData, error: profileError } = await supabase
            .from('users') // Ou 'profiles' selon votre configuration, 'users' est souvent une vue sur auth.users
            .select('*')
            .eq('id', userId)
            .single();
        
        if (!profileError && profileData) {
            setUserProfile(profileData);
        }

        // 2. Récupérer les dessins de l'utilisateur
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
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X color="#000" size={28} />
                </TouchableOpacity>
            </View>

            {/* INFO UTILISATEUR */}
            <View style={styles.userInfoContainer}>
                <View style={styles.avatarContainer}>
                    {userProfile?.avatar_url ? (
                        <Image source={{ uri: userProfile.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.placeholderAvatar]}>
                            <User size={30} color="#666" />
                        </View>
                    )}
                </View>
                <Text style={styles.userName}>{userProfile?.display_name || "Utilisateur"}</Text>
                {userProfile?.bio && <Text style={styles.userBio}>{userProfile.bio}</Text>}
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
                            <AlertCircle color="#CCC" size={32} />
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
  header: { padding: 15, alignItems: 'flex-end' },
  closeBtn: { padding: 5 },
  userInfoContainer: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  avatarContainer: { marginBottom: 10, shadowColor: "#000", shadowOffset: {width:0, height:2}, shadowOpacity:0.1, shadowRadius:4 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  userBio: { fontSize: 14, color: '#666', textAlign: 'center', marginHorizontal: 20 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 }
});