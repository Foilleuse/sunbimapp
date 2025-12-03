import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserMinus } from 'lucide-react-native';

export default function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchFollowing();
  }, [user]);

  const fetchFollowing = async () => {
    try {
      // On suppose une table 'follows' qui lie l'utilisateur courant (follower_id) aux utilisateurs suivis (following_id)
      // Et on fait une jointure pour récupérer les infos de l'utilisateur suivi (users)
      
      // Note: Si la table 'follows' n'existe pas encore, cette requête échouera.
      // Assurez-vous d'avoir une table 'follows' : id, follower_id (uuid), following_id (uuid), created_at
      
      const { data, error } = await supabase
        .from('follows')
        .select(`
          id,
          following:users!following_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('follower_id', user?.id);

      if (error) throw error;
      
      // Aplatir la structure pour avoir une liste d'utilisateurs simple
      const formattedData = data?.map((item: any) => ({
        followId: item.id,
        ...item.following
      })) || [];

      setFollowing(formattedData);
    } catch (e) {
      console.error("Erreur chargement amis:", e);
      // Fallback pour la démo si pas de données/table
      setFollowing([]); 
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (followId: string) => {
      // Logique pour ne plus suivre (suppression de la ligne dans 'follows')
      try {
          const { error } = await supabase.from('follows').delete().eq('id', followId);
          if (error) throw error;
          setFollowing(prev => prev.filter(item => item.followId !== followId));
      } catch (e) {
          console.error("Erreur unfollow:", e);
      }
  };

  const renderFriend = ({ item }: { item: any }) => (
    <View style={styles.friendItem}>
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
        
        <TouchableOpacity style={styles.unfollowBtn} onPress={() => handleUnfollow(item.followId)}>
            <UserMinus size={20} color="#999" />
        </TouchableOpacity>
    </View>
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