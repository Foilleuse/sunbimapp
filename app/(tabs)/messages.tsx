import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity, Dimensions, PixelRatio } from 'react-native';
import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserCheck, UserMinus } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
// Imports pour le background et le style
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Constantes de dimensions
const ROW_HEIGHT = 80; // Hauteur réduite pour une liste plus compacte sans dessins

// --- COMPOSANT BACKGROUND : MIROIR + FLOU ACCENTUÉ ---
const MirroredBackground = ({ uri, width, height }: { uri: string, width: number, height: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    // Le background prend tout l'écran
    const top = 0;
    // Flou augmenté pour effet "wallpaper" abstrait
    const BLUR_RADIUS = 60; 

    const EXTRA_WIDTH = 100;
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Couche floutée uniquement */}
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                <Group origin={vec(width / 2, height/2)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>
            {/* Suppression du Mask qui affichait l'image nette par-dessus */}
        </Canvas>
    );
};

// --- SOUS-COMPOSANT OPTIMISÉ POUR CHAQUE LIGNE ---
const FriendRow = memo(({ item, onOpenProfile, onUnfollow }: { item: any, onOpenProfile: (i: any) => void, onUnfollow: (fid: string, uid: string) => void }) => {
    
    const avatarUrl = item.avatar_url;

    return (
        <TouchableOpacity 
            style={styles.friendItem} 
            onPress={() => onOpenProfile(item)}
            activeOpacity={0.7}
        >
            {/* Fond semi-transparent subtil */}
            <View style={styles.rowBackground} />

            <View style={styles.friendInfoContainer}>
                <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.placeholderAvatar]}>
                            <User size={20} color="#666" />
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
                {/* Plus de dessin ici, juste le bouton de gestion */}
                <TouchableOpacity 
                    style={styles.unfollowBtn} 
                    onPress={() => onUnfollow(item.followId, item.id)}
                    hitSlop={15}
                >
                    <UserCheck size={20} color="#000" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
});

export default function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  // Gestion du style
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Hauteur fixe du header pour le padding (similaire à Gallery)
  const headerHeight = 100 + insets.top; 

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
      
      if (cloudData?.image_url) {
          setBackgroundCloud(cloudData.image_url);
      }

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

      // 4. Fusionner tout (plus besoin des dessins du jour ici)
      const formattedData = followsData.map(follow => {
          const userProfile = usersData?.find(u => u.id === follow.following_id);
          if (!userProfile) return null;
          
          return {
              followId: follow.id, 
              ...userProfile,
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

  const optimizedBackground = useMemo(() => {
    if (!backgroundCloud) return null;
    const w = Math.round(screenWidth * PixelRatio.get());
    const h = Math.round(screenHeight * PixelRatio.get());
    return getOptimizedImageUrl(backgroundCloud, w, h);
  }, [backgroundCloud, screenWidth, screenHeight]);

  const renderFriend = ({ item }: { item: any }) => (
      <FriendRow 
          item={item} 
          onOpenProfile={handleOpenProfile} 
          onUnfollow={handleUnfollow} 
      />
  );

  return (
    <View style={styles.container}>
      {/* 1. BACKGROUND (Plein écran) */}
      {backgroundCloud && (
          <MirroredBackground 
              uri={optimizedBackground || backgroundCloud}
              width={screenWidth}
              height={screenHeight} 
          />
      )}

      {/* 2. Header Flouté Absolu */}
      <BlurView 
          intensity={50} 
          tint="light" 
          style={[styles.absoluteHeader, { paddingTop: insets.top, height: 80 + insets.top }]}
      >
          <SunbimHeader showCloseButton={false} transparent={true} />
      </BlurView>
      
      {/* 3. Contenu Liste */}
      <View style={styles.content}>
        {loading ? (
            <ActivityIndicator style={{marginTop: 150}} color="#000" />
        ) : (
            <FlatList
                data={following}
                renderItem={renderFriend}
                keyExtractor={item => item.id} 
                // Padding pour passer sous le header et au-dessus de la navbar
                contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <User size={48} color="#000" />
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
  
  absoluteHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      justifyContent: 'center'
  },

  content: { flex: 1, paddingHorizontal: 0 }, 
  
  friendItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 15, 
      height: ROW_HEIGHT,
      paddingHorizontal: 20, 
      marginBottom: 2,
      // Pas de bordure inférieure pour un look épuré
  },
  
  // Fond subtil pour détacher le texte du background
  rowBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.4)', 
  },

  friendInfoContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      flex: 1,
      marginRight: 10
  },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  placeholderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  
  textContainer: { flex: 1, justifyContent: 'center' },
  friendName: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
  friendBio: { fontSize: 13, color: '#333', fontWeight: '400' },
  
  rightContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: 10,
  },
  unfollowBtn: { 
      padding: 10,
      backgroundColor: 'rgba(255,255,255,0.5)',
      borderRadius: 20
  },
  
  emptyState: { alignItems: 'center', marginTop: 150, gap: 10 },
  emptyText: { color: '#000', fontSize: 16, fontWeight: '600' }
});