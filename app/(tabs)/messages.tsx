import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity, Dimensions, PixelRatio } from 'react-native';
import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserMinus, UserCheck } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { DrawingViewer } from '../../src/components/DrawingViewer'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';

// Constantes de dimensions
const ROW_HEIGHT = 105;
const DRAWING_HEIGHT = ROW_HEIGHT - 20; // 85
const DRAWING_WIDTH = DRAWING_HEIGHT * (3/4); // ~64

// --- SOUS-COMPOSANT OPTIMISÉ POUR CHAQUE LIGNE ---
const FriendRow = memo(({ item, onOpenProfile, onUnfollow }: { item: any, onOpenProfile: (i: any) => void, onUnfollow: (fid: string, uid: string) => void }) => {
    
    // 1. Optimisation Avatar (Désactivée)
    // On utilise directement l'URL de l'avatar sans transformation
    const avatarUrl = item.avatar_url;

    // 2. Optimisation Miniature Dessin (Ratio 3:4 physique)
    const optimizedDrawingUrl = useMemo(() => {
        if (!item.todaysDrawing?.cloudImageUrl) return null;
        const w = Math.round(DRAWING_WIDTH * PixelRatio.get());
        const h = Math.round(DRAWING_HEIGHT * PixelRatio.get());
        return getOptimizedImageUrl(item.todaysDrawing.cloudImageUrl, w, h);
    }, [item.todaysDrawing?.cloudImageUrl]);

    return (
        <TouchableOpacity 
            style={styles.friendItem} 
            onPress={() => onOpenProfile(item)}
            activeOpacity={0.7}
        >
            <View style={styles.friendInfoContainer}>
                <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.placeholderAvatar]}>
                            <User size={24} color="#666" />
                        </View>
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.friendName} numberOfLines={1}>
                        {item.display_name || "Anonymous User"}
                    </Text>
                    {item.bio ? (
                        <Text style={styles.friendBio} numberOfLines={1}>{item.bio}</Text>
                    ) : null}
                </View>
            </View>
            
            <View style={styles.rightContainer}>
                {item.todaysDrawing ? (
                    <View style={[styles.miniDrawingContainer, { width: DRAWING_WIDTH, height: DRAWING_HEIGHT }]}>
                        <DrawingViewer 
                            // On passe l'URL optimisée ici
                            imageUri={optimizedDrawingUrl || item.todaysDrawing.cloudImageUrl}
                            canvasData={item.todaysDrawing.canvasData}
                            viewerSize={DRAWING_WIDTH}
                            viewerHeight={DRAWING_HEIGHT}
                            transparentMode={true} 
                            animated={false}
                            startVisible={true}
                        />
                    </View>
                ) : (
                    <TouchableOpacity 
                        style={styles.unfollowBtn} 
                        onPress={() => onUnfollow(item.followId, item.id)}
                        hitSlop={10}
                    >
                        <UserCheck size={20} color="#000" />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
});

export default function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
        if (user) fetchFollowing();
    }, [user])
  );

  const fetchFollowing = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // 1. Récupérer le nuage du jour
      const { data: cloudData } = await supabase.from('clouds').select('id, image_url').eq('published_for', today).maybeSingle();
      const todayCloudId = cloudData?.id;
      const todayCloudUrl = cloudData?.image_url;

      // 2. Récupérer les abonnements
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('id, following_id')
        .eq('follower_id', user?.id);

      if (followsError) throw followsError;

      if (!followsData || followsData.length === 0) {
          setFollowing([]);
          return;
      }

      // 3. Récupérer les infos des utilisateurs
      const followingIds = followsData.map(f => f.following_id);
      
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, bio')
        .in('id', followingIds);

      if (usersError) throw usersError;

      // 4. Récupérer les dessins du jour pour ces utilisateurs
      let todaysDrawings: any[] = [];
      if (todayCloudId && followingIds.length > 0) {
          const { data: drawingsData } = await supabase
            .from('drawings')
            .select('user_id, canvas_data, cloud_image_url')
            .eq('cloud_id', todayCloudId)
            .in('user_id', followingIds);
          
          todaysDrawings = drawingsData || [];
      }

      // 5. Fusionner tout
      const formattedData = followsData.map(follow => {
          const userProfile = usersData?.find(u => u.id === follow.following_id);
          if (!userProfile) return null;
          
          const userDrawing = todaysDrawings.find(d => d.user_id === follow.following_id);

          return {
              followId: follow.id, 
              ...userProfile,
              todaysDrawing: userDrawing ? {
                  canvasData: userDrawing.canvas_data,
                  cloudImageUrl: userDrawing.cloud_image_url || todayCloudUrl
              } : null
          };
      }).filter(item => item !== null);

      setFollowing(formattedData);

    } catch (e) {
      console.error("Error loading friends:", e);
      setFollowing([]); 
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (followId: string, userIdToUnfollow: string) => {
      try {
          const { error } = await supabase
            .from('follows')
            .delete()
            .eq('id', followId); 
            
          if (error) throw error;
          
          setFollowing(prev => prev.filter(item => item.id !== userIdToUnfollow));
      } catch (e) {
          console.error("Error unfollow:", e);
      }
  };

  const handleOpenProfile = (friend: any) => {
      setSelectedUser(friend);
      setIsProfileModalVisible(true);
  };

  // Le renderItem appelle maintenant le composant mémorisé FriendRow
  const renderFriend = ({ item }: { item: any }) => (
      <FriendRow 
          item={item} 
          onOpenProfile={handleOpenProfile} 
          onUnfollow={handleUnfollow} 
      />
  );

  return (
    <View style={styles.container}>
      <SunbimHeader showCloseButton={false} />
      
      <View style={styles.content}>
        {loading ? (
            <ActivityIndicator style={{marginTop: 20}} color="#000" />
        ) : (
            <FlatList
                data={following}
                renderItem={renderFriend}
                keyExtractor={item => item.id} 
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <User size={48} color="#CCC" />
                        <Text style={styles.emptyText}>You are not following anyone yet.</Text>
                    </View>
                }
            />
        )}
      </View>

      {selectedUser && (
        <UserProfileModal
            visible={isProfileModalVisible}
            onClose={() => setIsProfileModalVisible(false)}
            userId={selectedUser.id}
            initialUser={selectedUser}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  
  friendItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 10, 
      borderBottomWidth: 1, 
      borderBottomColor: '#F5F5F5',
      height: ROW_HEIGHT 
  },
  friendInfoContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      flex: 1,
      marginRight: 10
  },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  placeholderAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  
  textContainer: { flex: 1, justifyContent: 'center' },
  friendName: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  friendBio: { fontSize: 13, color: '#888' },
  
  rightContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 60
  },
  miniDrawingContainer: {
      borderRadius: 4,
      overflow: 'hidden',
  },
  unfollowBtn: { 
      padding: 10,
      backgroundColor: '#F5F5F5',
      borderRadius: 20
  },
  
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 }
});