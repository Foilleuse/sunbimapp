import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity, Dimensions, PixelRatio } from 'react-native';
import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserCheck } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { DrawingViewer } from '../../src/components/DrawingViewer'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
// Imports pour le background et le style
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Constantes de dimensions
const ROW_HEIGHT = 105;
const DRAWING_HEIGHT = ROW_HEIGHT - 20; 
const DRAWING_WIDTH = DRAWING_HEIGHT * (3/4); 

// --- COMPOSANT BACKGROUND : MIROIR + FLOU (Copie de Feed) ---
const MirroredBackground = ({ uri, width, height }: { uri: string, width: number, height: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    // Le background prend tout l'écran, on utilise height pour tout couvrir
    const top = 0;
    const bottom = height;
    const BLUR_RADIUS = 25; 

    const EXTRA_WIDTH = 100;
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                {/* On duplique l'image pour remplir tout l'écran si nécessaire ou créer l'effet miroir */}
                <Group origin={vec(width / 2, height/2)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>

            <Mask
                mode="luminance"
                mask={
                    <Rect x={0} y={0} width={width} height={height}>
                        <SkiaGradient
                            start={vec(0, 0)}
                            end={vec(0, height)}
                            colors={["white", "white", "white"]} // Masque plein pour tout montrer
                            positions={[0, 0.5, 1]}
                        />
                    </Rect>
                }
            >
                <SkiaImage
                    image={image}
                    x={0} y={0} width={width} height={height}
                    fit="cover"
                />
            </Mask>
        </Canvas>
    );
};

// --- SOUS-COMPOSANT OPTIMISÉ POUR CHAQUE LIGNE ---
const FriendRow = memo(({ item, onOpenProfile, onUnfollow }: { item: any, onOpenProfile: (i: any) => void, onUnfollow: (fid: string, uid: string) => void }) => {
    
    const avatarUrl = item.avatar_url;

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
            {/* Fond semi-transparent pour lisibilité */}
            <View style={styles.rowBackground} />

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
      const todayCloudId = cloudData?.id;
      const todayCloudUrl = cloudData?.image_url;

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
  container: { flex: 1, backgroundColor: '#FFF' }, // Background blanc par défaut, couvert par l'image
  
  absoluteHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      justifyContent: 'center'
  },

  content: { flex: 1, paddingHorizontal: 20 },
  
  friendItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 10, 
      height: ROW_HEIGHT,
      marginBottom: 10,
      borderRadius: 15,
      paddingHorizontal: 10,
      overflow: 'hidden',
      position: 'relative',
  },
  // Fond semi-transparent pour la lisibilité sur le nuage
  rowBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.6)', 
  },

  friendInfoContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      flex: 1,
      marginRight: 10
  },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  placeholderAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  textContainer: { flex: 1, justifyContent: 'center' },
  friendName: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 2 },
  friendBio: { fontSize: 13, color: '#333', fontWeight: '500' },
  
  rightContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 60
  },
  miniDrawingContainer: {
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)'
  },
  unfollowBtn: { 
      padding: 10,
      backgroundColor: 'rgba(255,255,255,0.8)',
      borderRadius: 20
  },
  
  emptyState: { alignItems: 'center', marginTop: 100, gap: 10 },
  emptyText: { color: '#000', fontSize: 16, fontWeight: '600' }
});