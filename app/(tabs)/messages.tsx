import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, TouchableOpacity, Dimensions, PixelRatio, TextInput, Keyboard, Pressable } from 'react-native';
import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { User, UserCheck, UserPlus, Search, XCircle } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
// Imports pour le background et le style
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Constantes de dimensions
const ROW_HEIGHT = 70;

// --- COMPOSANT BACKGROUND : MIROIR + FLOU ACCENTUÉ ---
const MirroredBackground = ({ uri, width, height }: { uri: string, width: number, height: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const top = 0;
    const BLUR_RADIUS = 60; 

    const EXTRA_WIDTH = 100;
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                <Group origin={vec(width / 2, height/2)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>
        </Canvas>
    );
};

// --- SOUS-COMPOSANT LIGNE UTILISATEUR ---
const UserRow = memo(({ item, onOpenProfile, onToggleFollow, isSelf }: { item: any, onOpenProfile: (i: any) => void, onToggleFollow: (user: any) => void, isSelf: boolean }) => {
    
    const avatarUrl = item.avatar_url;

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
            
            {!isSelf && (
                <View style={styles.rightContainer}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, item.isFollowing ? styles.followingBtn : styles.followBtn]} 
                        onPress={() => onToggleFollow(item)}
                        hitSlop={15}
                    >
                        {item.isFollowing ? (
                            <UserCheck size={20} color="#000" />
                        ) : (
                            <UserPlus size={20} color="#FFF" />
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
});

export default function FriendsPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  // Hauteur dynamique du header pour le padding de la liste (similaire à Gallery)
  const [headerHeight, setHeaderHeight] = useState(130);
  
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  useFocusEffect(
    useCallback(() => {
        if (user) {
            fetchFollowing();
        }
    }, [user])
  );

  const fetchFollowing = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // 1. Background
      const { data: cloudData } = await supabase.from('clouds').select('id, image_url').eq('published_for', today).maybeSingle();
      if (cloudData?.image_url) setBackgroundCloud(cloudData.image_url);

      // 2. Récupérer les abonnements
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('id, following_id')
        .eq('follower_id', user?.id);

      if (followsError) throw followsError;

      const followingIds = followsData?.map(f => f.following_id) || [];
      
      if (followingIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, display_name, avatar_url, bio')
            .in('id', followingIds);

          if (usersError) throw usersError;

          const formattedData = usersData?.map(u => ({
              ...u,
              isFollowing: true, // Par définition, ils sont dans la liste "Following"
              followId: followsData.find(f => f.following_id === u.id)?.id
          })) || [];

          setFollowing(formattedData);
      } else {
          setFollowing([]);
      }

    } catch (e) {
      console.error("Error loading friends:", e);
    } finally {
      setLoading(false);
    }
  };

  // --- RECHERCHE UTILISATEURS ---
  const handleSearch = async (text: string) => {
      setSearchText(text);
      if (text.trim().length === 0) {
          setIsSearching(false);
          setSearchResults([]);
          return;
      }
      
      setIsSearching(true);
      try {
          // 1. Chercher les users qui correspondent (exclure soi-même)
          const { data: foundUsers, error } = await supabase
            .from('users')
            .select('id, display_name, avatar_url, bio')
            .ilike('display_name', `%${text}%`)
            .neq('id', user?.id)
            .limit(20);
          
          if (error) throw error;

          if (!foundUsers || foundUsers.length === 0) {
              setSearchResults([]);
              return;
          }

          // 2. Vérifier si on les suit déjà (comparaison avec la liste locale `following`)
          // On pourrait refaire une requête serveur pour être sûr à 100%, mais la liste locale est suffisante pour l'UI instantanée
          const followingMap = new Map(following.map(f => [f.id, f.followId]));

          const resultsWithStatus = foundUsers.map(u => ({
              ...u,
              isFollowing: followingMap.has(u.id),
              followId: followingMap.get(u.id)
          }));

          setSearchResults(resultsWithStatus);

      } catch (e) {
          console.error("Search error:", e);
      }
  };

  const handleToggleFollow = async (targetUser: any) => {
      if (!user) return;

      // Optimistic Update
      const isNowFollowing = !targetUser.isFollowing;
      
      // Update local lists helper
      const updateList = (list: any[]) => list.map(u => 
        u.id === targetUser.id ? { ...u, isFollowing: isNowFollowing } : u
      );

      if (isSearching) setSearchResults(updateList(searchResults));
      else setFollowing(prev => prev.filter(u => u.id !== targetUser.id)); // Si on est dans la liste "Abonnés" et qu'on unfollow, on retire

      try {
          if (isNowFollowing) {
              // FOLLOW
              const { data, error } = await supabase
                .from('follows')
                .insert({ follower_id: user.id, following_id: targetUser.id })
                .select()
                .single();
              
              if (error) throw error;
              
              // Si on est en recherche, on met à jour l'ID de follow pour pouvoir unfollow ensuite
              if (isSearching) {
                  setSearchResults(prev => prev.map(u => u.id === targetUser.id ? { ...u, followId: data.id } : u));
                  // On l'ajoute aussi à la liste silencieuse des abonnés pour le cache
                  setFollowing(prev => [...prev, { ...targetUser, isFollowing: true, followId: data.id }]);
              }

          } else {
              // UNFOLLOW
              // On a besoin de l'ID de la relation 'follows'. 
              // Si on vient de la liste 'following', on l'a. 
              // Si on est en recherche, on l'a calculé.
              let followId = targetUser.followId;
              
              // Fallback sécurité si pas d'ID (ex: désynchro), on cherche avec les ID users
              if (!followId) {
                  const { data } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', targetUser.id).single();
                  followId = data?.id;
              }

              if (followId) {
                  const { error } = await supabase.from('follows').delete().eq('id', followId);
                  if (error) throw error;
              }
          }
      } catch (e) {
          console.error("Error toggle follow:", e);
          // Revert optimistic update en cas d'erreur (optionnel, pour faire simple on laisse)
          fetchFollowing(); // On recharge la vérité
      }
  };

  const handleOpenProfile = (friend: any) => {
      setSelectedUser(friend);
      setIsProfileModalVisible(true);
  };

  const clearSearch = () => {
    setSearchText('');
    setIsSearching(false);
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const optimizedBackground = useMemo(() => {
    if (!backgroundCloud) return null;
    const w = Math.round(screenWidth * PixelRatio.get());
    const h = Math.round(screenHeight * PixelRatio.get());
    return getOptimizedImageUrl(backgroundCloud, w, h);
  }, [backgroundCloud, screenWidth, screenHeight]);

  const renderUser = ({ item }: { item: any }) => (
      <UserRow 
          item={item} 
          onOpenProfile={handleOpenProfile} 
          onToggleFollow={handleToggleFollow}
          isSelf={item.id === user?.id}
      />
  );

  const displayData = isSearching ? searchResults : following;

  return (
    <View style={styles.container}>
      {/* 1. BACKGROUND */}
      {backgroundCloud && (
          <MirroredBackground 
              uri={optimizedBackground || backgroundCloud}
              width={screenWidth}
              height={screenHeight} 
          />
      )}

      {/* 2. Header Flouté (Statique + Barre de Recherche comme Gallery) */}
      <BlurView 
          intensity={80} 
          tint="light" 
          style={[styles.absoluteHeader, { paddingTop: insets.top }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
          {/* Header Titre */}
          <SunbimHeader showCloseButton={false} transparent={true} />
          
          {/* Outils / Barre de Recherche en dessous */}
          <View style={styles.toolsContainer}>
              <View style={styles.searchBar}>
                  <Search size={18} color="#999" />
                  <TextInput
                      style={styles.searchInput}
                      placeholder="Search friends..."
                      placeholderTextColor="#999"
                      value={searchText}
                      onChangeText={handleSearch}
                      returnKeyType="search"
                      autoCapitalize="none"
                      clearButtonMode="while-editing"
                  />
                  {searchText.length > 0 && (
                      <TouchableOpacity onPress={clearSearch}>
                          <XCircle size={18} color="#CCC" />
                      </TouchableOpacity>
                  )}
              </View>
          </View>
          
          {/* Séparateur */}
          <View style={styles.headerSeparator} />
      </BlurView>
      
      {/* 3. Contenu Liste */}
      <View style={styles.content}>
        {loading ? (
            <ActivityIndicator style={{marginTop: headerHeight + 50}} color="#000" />
        ) : (
            <FlatList
                data={displayData}
                renderItem={renderUser}
                keyExtractor={item => item.id} 
                contentContainerStyle={{ paddingTop: headerHeight + 10, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        {isSearching ? (
                            <Text style={styles.emptyText}>No users found.</Text>
                        ) : (
                            <>
                                <User size={48} color="#000" />
                                <Text style={styles.emptyText}>You are not following anyone yet.</Text>
                            </>
                        )}
                    </View>
                }
            />
        )}
      </View>

      {selectedUser && (
        <UserProfileModal
            visible={isProfileModalVisible}
            onClose={() => {
                setIsProfileModalVisible(false);
                // Si on a modifié le statut dans la modale, on rafraichit la liste au retour
                if (!isSearching) fetchFollowing(); 
            }}
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
      // Le BlurView gère le background
  },
  
  // Style aligné sur GalleryPage
  toolsContainer: {
      paddingHorizontal: 15,
      paddingBottom: 10,
      paddingTop: 5,
      marginTop: 50, // Pousse sous le titre nyola
  },
  
  headerSeparator: {
      height: 1,
      backgroundColor: 'rgba(0,0,0,0.05)',
      width: '100%',
  },

  searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.05)', // Gris clair comme Gallery
      borderRadius: 20, // Plus arrondi comme Gallery
      paddingHorizontal: 12,
      height: 40,
      gap: 8
  },
  searchInput: {
      flex: 1,
      fontSize: 14, // Taille ajustée
      color: '#000',
      height: '100%'
  },

  content: { flex: 1 }, 
  
  friendItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 10, 
      height: ROW_HEIGHT,
      paddingHorizontal: 20, 
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
  actionBtn: { 
      padding: 8,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center'
  },
  followingBtn: {
      backgroundColor: 'rgba(255,255,255,0.6)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)'
  },
  followBtn: {
      backgroundColor: '#000',
  },
  
  emptyState: { alignItems: 'center', marginTop: 100, gap: 10 },
  emptyText: { color: '#000', fontSize: 16, fontWeight: '600' }
});