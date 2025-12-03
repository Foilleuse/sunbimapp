import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserMinus, UserCheck } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 

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
      // Requête avec alias 'following' pointant vers la table users via la clé étrangère following_id
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
      
      // Transformation des données pour aplatir la structure
      // On vérifie bien que 'item.following' existe (c'est l'objet user joint)
      const formattedData = data?.map((item: any) => {
          if (!item.following) return null; // Sécurité si user supprimé mais follow restant
          return {
            followId: item.id, // ID de la relation follow
            id: item.following.id, // ID de l'utilisateur suivi (ESSENTIEL pour le profil)
            display_name: item.following.display_name,
            avatar_url: item.following.avatar_url,
            bio: item.following.bio
          };
      }).filter(item => item !== null) || [];

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
            .eq('id', followId); // Suppression directe par ID de relation (plus simple si on l'a)
            
          if (error) throw error;
          
          // Mise à jour optimiste de la liste
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
            {/* AVATAR */}
            <View style={styles.avatarContainer}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.placeholderAvatar]}>
                        <User size={24} color="#666" />
                    </View>
                )}
            </View>

            {/* TEXTE */}
            <View style={styles.textContainer}>
                <Text style={styles.friendName} numberOfLines={1}>
                    {item.display_name || "Utilisateur Anonyme"}
                </Text>
                {item.bio ? (
                    <Text style={styles.friendBio} numberOfLines={1}>{item.bio}</Text>
                ) : null}
            </View>
        </View>
        
        {/* BOUTON ACTION (Ne plus suivre) */}
        <TouchableOpacity 
            style={styles.unfollowBtn} 
            onPress={() => handleUnfollow(item.followId, item.id)}
            hitSlop={10}
        >
            <UserCheck size={20} color="#000" />
        </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SunbimHeader showCloseButton={false} />
      
      <View style={styles.content}>
        <Text style={styles.title}>Mes Amis</Text>
        <Text style={styles.subtitle}>Les comptes que vous suivez ({following.length})</Text>

        {loading ? (
            <ActivityIndicator style={{marginTop: 20}} color="#000" />
        ) : (
            <FlatList
                data={following}
                renderItem={renderFriend}
                keyExtractor={item => item.id} // Utiliser l'ID utilisateur comme clé stable
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
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#000', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  
  friendItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 15, 
      borderBottomWidth: 1, 
      borderBottomColor: '#F5F5F5' 
  },
  friendInfoContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      flex: 1,
      marginRight: 10
  },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  placeholderAvatar: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  
  textContainer: { flex: 1, justifyContent: 'center' },
  friendName: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  friendBio: { fontSize: 13, color: '#888' },
  
  unfollowBtn: { 
      padding: 10,
      backgroundColor: '#F5F5F5',
      borderRadius: 20
  },
  
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 }
});