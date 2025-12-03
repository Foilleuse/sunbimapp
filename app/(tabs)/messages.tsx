import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserMinus } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; // Import de la modale profil

export default function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour la modale profil
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
      const { data, error } = await supabase
        .from('follows')
        .select(`
          id,
          following:users!following_id (
            id,
            display_name,
            avatar_url,
            bio
          )
        `)
        .eq('follower_id', user?.id);

      if (error) throw error;
      
      const formattedData = data?.map((item: any) => ({
        followId: item.id,
        ...item.following
      })) || [];

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
            .eq('follower_id', user?.id)
            .eq('following_id', userIdToUnfollow); // Suppression par IDs user plus sûr
            
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
        <View style={styles.friendInfo}>
            {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}>
                    <User size={20} color="#666" />
                </View>
            )}
            <Text style={styles.friendName}>{item.display_name || "Utilisateur"}</Text>
        </View>
        
        <TouchableOpacity 
            style={styles.unfollowBtn} 
            onPress={() => handleUnfollow(item.followId, item.id)}
            hitSlop={10}
        >
            <UserMinus size={20} color="#999" />
        </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SunbimHeader showCloseButton={false} />
      
      <View style={styles.content}>
        <Text style={styles.title}>Mes Amis</Text>
        <Text style={styles.subtitle}>Les comptes que vous suivez</Text>

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

      {/* Modale Profil Utilisateur */}
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
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#000', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 25 },
  
  friendItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 15, 
      borderBottomWidth: 1, 
      borderBottomColor: '#F5F5F5' 
  },
  friendInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  friendName: { fontSize: 16, fontWeight: '700', color: '#333' },
  
  unfollowBtn: { padding: 10 },
  
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 }
});