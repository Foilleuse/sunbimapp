import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserMinus, UserCheck } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { DrawingViewer } from '../../src/components/DrawingViewer'; 

export default function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  // Hauteur de ligne définie ici pour calculer le ratio
  const ROW_HEIGHT = 105;
  const DRAWING_HEIGHT = ROW_HEIGHT - 20; // Marge interne
  const DRAWING_WIDTH = DRAWING_HEIGHT * (3/4); // Ratio 3:4

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
      console.error("Erreur chargement amis:", e);
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
          console.error("Erreur unfollow:", e);
      }
  };

  const handleOpenProfile = (friend: any) => {
      setSelectedUser(friend);
      setIsProfileModalVisible(true);
  };

  const renderFriend = ({ item }: { item: any }) => (
    <TouchableOpacity 
        style={styles.friendItem} 
        onPress={() => handleOpenProfile(item)}
        activeOpacity={0.7}
    >
        <View style={styles.friendInfoContainer}>
            <View style={styles.avatarContainer}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.placeholderAvatar]}>
                        <User size={24} color="#666" />
                    </View>
                )}
            </View>

            <View style={styles.textContainer}>
                <Text style={styles.friendName} numberOfLines={1}>
                    {item.display_name || "Utilisateur Anonyme"}
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
                        imageUri={item.todaysDrawing.cloudImageUrl}
                        canvasData={item.todaysDrawing.canvasData}
                        viewerSize={DRAWING_WIDTH}
                        viewerHeight={DRAWING_HEIGHT}
                        transparentMode={true} // Fond transparent (pas de nuage)
                        animated={false}
                        startVisible={true}
                    />
                </View>
            ) : (
                <TouchableOpacity 
                    style={styles.unfollowBtn} 
                    onPress={() => handleUnfollow(item.followId, item.id)}
                    hitSlop={10}
                >
                    <UserCheck size={20} color="#000" />
                </TouchableOpacity>
            )}
        </View>
    </TouchableOpacity>
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
                        <Text style={styles.emptyText}>Vous ne suivez personne pour le moment.</Text>
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
      paddingVertical: 10, // Réduit le padding vertical car la hauteur est fixée
      borderBottomWidth: 1, 
      borderBottomColor: '#F5F5F5',
      height: 105 
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
      // Dimensions gérées dynamiquement
      borderRadius: 4,
      overflow: 'hidden',
      // backgroundColor: 'transparent', // Par défaut
      // Pas de bordure
  },
  unfollowBtn: { 
      padding: 10,
      backgroundColor: '#F5F5F5',
      borderRadius: 20
  },
  
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 }
});