import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Alert, Pressable, Platform, SafeAreaView, PixelRatio, ScrollView } from 'react-native';
import { X, User, UserPlus, UserCheck, Heart, MessageCircle, Lock, AlertCircle, Unlock, Lightbulb, Palette, Zap, MoreHorizontal } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';
import { useAuth } from '../contexts/AuthContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
// Ajout des imports d'animation et Skia
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialUser?: any; 
}

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

// --- COMPOSANT BACKGROUND : MIROIR + FLOU + FONDU ÉTENDU (identique à gallery.tsx) ---
const MirroredBackground = ({ uri, width, height, top }: { uri: string, width: number, height: number, top: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const bottom = top + height;
    const BLUR_RADIUS = 25; 

    const EXTRA_WIDTH = 100;
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                <Group origin={vec(width / 2, top)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
                <Group origin={vec(width / 2, bottom)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>

            <Mask
                mode="luminance"
                mask={
                    <Rect x={0} y={top} width={width} height={height}>
                        <SkiaGradient
                            start={vec(0, top)}
                            end={vec(0, bottom)}
                            colors={["black", "white", "white", "black"]}
                            positions={[0, 0.2, 0.8, 1]}
                        />
                    </Rect>
                }
            >
                <SkiaImage
                    image={image}
                    x={0} y={top} width={width} height={height}
                    fit="cover"
                />
            </Mask>
        </Canvas>
    );
};

// --- COMPOSANT BOUTON DE RÉACTION ANIMÉ ---
const AnimatedReactionBtn = ({ onPress, isActive, icon: Icon, color, count }: any) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePress = () => {
        scale.value = withSequence(
            withSpring(1.6, { damping: 10, stiffness: 200 }),
            withSpring(1, { damping: 10, stiffness: 200 })
        );
        onPress();
    };

    return (
        <Pressable onPress={handlePress} style={styles.reactionBtn}>
            <Animated.View style={animatedStyle}>
                <Icon
                    color={isActive ? color : "#FFF"}
                    fill={isActive ? color : "transparent"}
                    size={24}
                />
            </Animated.View>
        </Pressable>
    );
};

// --- COMPOSANT MÉMORISÉ POUR LA GRILLE ---
const DrawingGridItem = memo(({ item, size, isUnlocked, onPress, spacing }: any) => {
    
    // 🔥 OPTIMISATION GRILLE : CONSERVÉE (Calcul de l'image exacte 3:4)
    const optimizedGridUri = useMemo(() => {
        if (!item.cloud_image_url) return null;
        // Calcul des pixels physiques nécessaires
        const w = Math.round(size * PixelRatio.get());
        const h = Math.round(w * (4/3)); // Ratio 3:4
        // Demande de crop au serveur
        return getOptimizedImageUrl(item.cloud_image_url, w, h);
    }, [item.cloud_image_url, size]);

    return (
        <TouchableOpacity 
            onPress={() => onPress(item)}
            disabled={!isUnlocked} 
            style={{ width: size, aspectRatio: 3/4, marginBottom: spacing, backgroundColor: '#F9F9F9', overflow: 'hidden', position: 'relative' }}
        >
            <DrawingViewer 
                // ✅ Utilisation de l'URL optimisée
                imageUri={optimizedGridUri || item.cloud_image_url}
                canvasData={isUnlocked ? item.canvas_data : []}
                viewerSize={size}
                viewerHeight={size * (4/3)} // Ajout hauteur explicite
                transparentMode={false}
                animated={false}
                startVisible={true}
                autoCenter={false} // Pas d'auto-center pour la grille
            />
            {!isUnlocked && (
                <View style={styles.missedOverlay}>
                    <AlertCircle color="#000" size={32} style={{ marginBottom: 5 }} />
                    <Text style={styles.missedDate}>
                        {new Date(item.created_at).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}, (prev, next) => {
    return prev.item.id === next.item.id && prev.isUnlocked === next.isUnlocked && prev.size === next.size;
});

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, userId, initialUser }) => {
  const { user: currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(initialUser || null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [unlockedCloudIds, setUnlockedCloudIds] = useState<string[]>([]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  
  // États pour les réactions du dessin sélectionné
  const [userReaction, setUserReaction] = useState<ReactionType>(null);
  const [reactionCounts, setReactionCounts] = useState({
      like: 0,
      smart: 0,
      beautiful: 0,
      crazy: 0
  });

  // Ajout d'un état pour retarder l'animation
  const [animationReady, setAnimationReady] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1; 
  const NUM_COLS = 2;
  const ITEM_SIZE = (screenWidth - (SPACING * (NUM_COLS - 1))) / NUM_COLS;

  useEffect(() => {
    let isMounted = true;

    const initModal = async () => {
        if (visible && userId) {
            if (isMounted) {
                setLoading(true);
                setDrawings([]);
                setUnlockedCloudIds([]);
                setIsBlocked(false);
            }

            if (currentUser && currentUser.id !== userId) {
                checkFollowStatus();
                checkBlockStatus();
            }
            await fetchData(isMounted);
        } else {
            if (isMounted) {
                setLoading(true);
                setDrawings([]);
                setIsFollowing(false);
                setIsBlocked(false);
                setSelectedDrawing(null); 
                setUnlockedCloudIds([]);
            }
        }
    };

    initModal();

    return () => { isMounted = false; };
  }, [visible, userId, currentUser]);

  // Chargement des réactions quand un dessin est ouvert
  useEffect(() => {
    if (selectedDrawing) {
        fetchReactionsState();
        // Délai pour l'animation
        setAnimationReady(false);
        const timer = setTimeout(() => setAnimationReady(true), 300);
        return () => clearTimeout(timer);
    } else {
        setAnimationReady(false);
    }
  }, [selectedDrawing]);

  // 🔥 OPTIMISATION MODALE VIEW : Calcul de l'image HD 3:4 pour la vue détaillée
  const selectedDrawingImageOptimized = useMemo(() => {
    if (!selectedDrawing?.cloud_image_url) return null;
    const w = Math.round(screenWidth * PixelRatio.get());
    const h = Math.round(w * (4/3));
    return getOptimizedImageUrl(selectedDrawing.cloud_image_url, w, h);
  }, [selectedDrawing, screenWidth]);

  const fetchReactionsState = async () => {
        if (!selectedDrawing) return;
        try {
            const { data: allReactions, error } = await supabase
                .from('reactions')
                .select('reaction_type, user_id')
                .eq('drawing_id', selectedDrawing.id);

            if (error) throw error;

            const counts = { like: 0, smart: 0, beautiful: 0, crazy: 0 };
            let myReaction: ReactionType = null;

            allReactions?.forEach((r: any) => {
                if (counts.hasOwnProperty(r.reaction_type)) {
                    counts[r.reaction_type as keyof typeof counts]++;
                }
                if (currentUser && r.user_id === currentUser.id) {
                    myReaction = r.reaction_type as ReactionType;
                }
            });

            setReactionCounts(counts);
            setUserReaction(myReaction);

        } catch (e) {
            console.error("Erreur chargement réactions:", e);
        }
  };

  const handleReaction = async (type: ReactionType) => {
        if (!currentUser || !type || !selectedDrawing) return;

        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };

        if (userReaction === type) {
            setUserReaction(null);
            setReactionCounts(prev => ({
                ...prev,
                [type]: Math.max(0, prev[type] - 1)
            }));
            
            try {
                await supabase.from('reactions').delete().eq('user_id', currentUser.id).eq('drawing_id', selectedDrawing.id);
            } catch (e) {
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        } 
        else {
            setUserReaction(type);
            setReactionCounts(prev => {
                const newCounts = { ...prev };
                if (previousReaction) {
                    newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
                }
                newCounts[type]++;
                return newCounts;
            });

            try {
                const { error } = await supabase
                    .from('reactions')
                    .upsert({
                        user_id: currentUser.id,
                        drawing_id: selectedDrawing.id,
                        reaction_type: type
                    }, { onConflict: 'user_id, drawing_id' });
                
                if (error) throw error;
            } catch (e) {
                console.error(e);
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        }
  };

  const handleReport = () => {
    if (!selectedDrawing) return;
    Alert.alert(
        "Options",
        "Que souhaitez-vous faire ?",
        [
            { text: "Annuler", style: "cancel" },
            { 
                text: "Signaler le contenu", 
                onPress: async () => {
                    if (!currentUser) return Alert.alert("Erreur", "Vous devez être connecté pour signaler.");
                    try {
                        const { error } = await supabase
                            .from('reports')
                            .insert({ reporter_id: currentUser.id, drawing_id: selectedDrawing.id, reason: 'Contenu inapproprié' });
                        
                        if (error) throw error;
                        Alert.alert("Signalement envoyé", "Nous allons examiner cette image. Merci de votre vigilance.");
                    } catch (e) {
                        console.error(e);
                        Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
                    }
                }
            }
        ]
    );
  };

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

  const checkBlockStatus = async () => {
      try {
          const { count } = await supabase
            .from('blocks')
            .select('*', { count: 'exact', head: true })
            .eq('blocker_id', currentUser?.id)
            .eq('blocked_id', userId);
          
          setIsBlocked(count !== null && count > 0);
      } catch (e) {
          console.error("Erreur check block:", e);
      }
  };

  const toggleFollow = async () => {
      if (!currentUser) return;
      setFollowLoading(true);
      try {
          if (isFollowing) {
              const { error } = await supabase
                .from('follows')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId);
              if (error) throw error;
              setIsFollowing(false);
          } else {
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

  const handleUnblock = async () => {
      if (!currentUser) return;
      setFollowLoading(true);
      try {
          const { error } = await supabase
            .from('blocks')
            .delete()
            .eq('blocker_id', currentUser.id)
            .eq('blocked_id', userId);
          
          if (error) throw error;
          
          setIsBlocked(false);
          Alert.alert("Utilisateur débloqué", "Vous pouvez maintenant voir son contenu.");
          fetchData(true);
      } catch (e: any) {
          Alert.alert("Erreur", "Impossible de débloquer.");
          console.error(e);
      } finally {
          setFollowLoading(false);
      }
  };

  const fetchData = async (isMounted: boolean) => {
    try {
        const { data: profileData } = await supabase
            .from('users') 
            .select('*')
            .eq('id', userId)
            .single();
        
        if (isMounted && profileData) setUserProfile(profileData);

        const { data: drawingsData, error: drawingsError } = await supabase
            .from('drawings')
            .select('*') 
            .eq('user_id', userId)
            .eq('is_hidden', false) 
            .order('created_at', { ascending: false });

        if (drawingsError) throw drawingsError;
        if (isMounted) setDrawings(drawingsData || []);

        if (currentUser) {
            const { data: myDrawings } = await supabase
                .from('drawings')
                .select('cloud_id')
                .eq('user_id', currentUser.id);
            
            if (isMounted && myDrawings) {
                const myCloudIds = myDrawings.map(d => d.cloud_id);
                setUnlockedCloudIds(myCloudIds);
            }
        }

    } catch (e) {
        console.error("Erreur chargement données profil:", e);
    } finally {
        if (isMounted) setLoading(false);
    }
  };

  const openDrawing = useCallback((drawing: any) => setSelectedDrawing(drawing), []);
  
  const closeDrawing = () => {
      setSelectedDrawing(null);
      // Reset reactions local state
      setUserReaction(null);
      setReactionCounts({ like: 0, smart: 0, beautiful: 0, crazy: 0 });
  };

  const renderDrawingItem = useCallback(({ item }: { item: any }) => {
    const isUnlocked = (currentUser?.id === userId) || unlockedCloudIds.includes(item.cloud_id);

    return (
        <DrawingGridItem 
            item={item}
            size={ITEM_SIZE}
            spacing={SPACING}
            isUnlocked={isUnlocked}
            onPress={openDrawing}
        />
    );
  }, [currentUser, userId, unlockedCloudIds, ITEM_SIZE, SPACING, openDrawing]);
  
  const isSelectedUnlocked = selectedDrawing && (
      (currentUser?.id === userId) || unlockedCloudIds.includes(selectedDrawing.cloud_id)
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={15}>
                    <X color="#000" size={28} />
                </TouchableOpacity>
            </View>

            <View style={styles.profileBlock}>
                <View style={styles.profileInfoContainer}>
                    {userProfile?.avatar_url ? (
                        <Image 
                            // ✅ MODIFICATION : Utilisation directe de l'URL sans transformation
                            source={{ uri: userProfile.avatar_url }} 
                            style={styles.profileAvatar} 
                        />
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

                    {currentUser && currentUser.id !== userId && (
                        <View style={{ marginLeft: 10 }}>
                             {isBlocked ? (
                                <TouchableOpacity 
                                    style={[styles.iconOnlyBtn, styles.unblockBtn]} 
                                    onPress={handleUnblock}
                                    disabled={followLoading}
                                >
                                    {followLoading ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Unlock color="#FFF" size={20} />
                                    )}
                                </TouchableOpacity>
                             ) : (
                                <TouchableOpacity 
                                    style={[styles.iconOnlyBtn, isFollowing && styles.followingBtn]} 
                                    onPress={toggleFollow}
                                    disabled={followLoading}
                                >
                                    {followLoading ? (
                                        <ActivityIndicator color="#000" size="small" />
                                    ) : (
                                        isFollowing ? <UserCheck color="#000" size={20} /> : <UserPlus color="#000" size={20} />
                                    )}
                                </TouchableOpacity>
                             )}
                        </View>
                    )}
                </View>
            </View>

            {isBlocked ? (
                <View style={styles.blockedState}>
                    <Lock color="#CCC" size={40} />
                    <Text style={styles.emptyText}>Vous avez bloqué cet utilisateur.</Text>
                    <Text style={styles.blockedSubText}>Débloquez-le pour voir ses dessins.</Text>
                </View>
            ) : (
                loading ? (
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
                )
            )}

            {/* MODALE D'AGRANDISSEMENT IDENTIQUE A GALLERY */}
            <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDrawing}>
                {selectedDrawing && (
                    <View style={styles.modalContainer}>
                        {/* FOND MIROIR AJOUTÉ */}
                        <MirroredBackground 
                            uri={selectedDrawingImageOptimized || selectedDrawing.cloud_image_url}
                            width={screenWidth}
                            height={screenWidth * (4/3)}
                            top={60} 
                        />

                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeDrawing} style={styles.closeBtnTransparent} hitSlop={15}>
                                <X color="#FFF" size={30} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
                            showsVerticalScrollIndicator={false}
                        >
                            <Pressable 
                                onPressIn={() => {
                                    if (isSelectedUnlocked) setIsHolding(true);
                                }} 
                                onPressOut={() => setIsHolding(false)}
                                style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: 'transparent', marginTop: 0 }}
                            >
                                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                                    {/* Animation retardée pour éviter les saccades */}
                                    {animationReady && (
                                        <DrawingViewer
                                            imageUri={selectedDrawingImageOptimized || selectedDrawing.cloud_image_url} 
                                            canvasData={isSelectedUnlocked ? selectedDrawing.canvas_data : []}
                                            viewerSize={screenWidth} 
                                            viewerHeight={screenWidth * (4/3)} 
                                            transparentMode={false} // On affiche le fond (nuage) ici pour alignement
                                            startVisible={false} 
                                            animated={true}
                                            autoCenter={false} 
                                        />
                                    )}
                                    {/* Preview statique immédiate */}
                                    {!animationReady && (
                                        <DrawingViewer
                                            imageUri={selectedDrawingImageOptimized || selectedDrawing.cloud_image_url} 
                                            canvasData={isSelectedUnlocked ? selectedDrawing.canvas_data : []}
                                            viewerSize={screenWidth} 
                                            viewerHeight={screenWidth * (4/3)} 
                                            transparentMode={false}
                                            startVisible={true} 
                                            animated={false}
                                            autoCenter={false} 
                                        />
                                    )}
                                </View>
                                {isSelectedUnlocked && <Text style={styles.hintText}>Maintenir pour voir l'original</Text>}
                            </Pressable>

                            {/* INFO CARD TRANSPARENT AVEC TEXTE BLANC */}
                            <View style={styles.infoCard}>
                                <View style={styles.infoContent}>
                                    <View style={styles.titleRow}>
                                        <Text style={styles.drawingTitle} numberOfLines={1}>
                                            {selectedDrawing.label || "Sans titre"}
                                        </Text>
                                        
                                        <TouchableOpacity onPress={handleReport} style={styles.moreBtnAbsolute} hitSlop={15}>
                                            <MoreHorizontal color="#CCC" size={24} />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <Text style={styles.userName}>{userProfile?.display_name || "Anonyme"}</Text>

                                    {/* BARRE DE RÉACTIONS */}
                                    <View style={styles.reactionBar}>
                                        <AnimatedReactionBtn
                                            icon={Heart}
                                            color="#FF3B30"
                                            isActive={userReaction === 'like'}
                                            count={reactionCounts.like}
                                            onPress={() => handleReaction('like')}
                                        />
                                        <AnimatedReactionBtn
                                            icon={Lightbulb}
                                            color="#FFCC00"
                                            isActive={userReaction === 'smart'}
                                            count={reactionCounts.smart}
                                            onPress={() => handleReaction('smart')}
                                        />
                                        <AnimatedReactionBtn
                                            icon={Palette}
                                            color="#5856D6"
                                            isActive={userReaction === 'beautiful'}
                                            count={reactionCounts.beautiful}
                                            onPress={() => handleReaction('beautiful')}
                                        />
                                        <AnimatedReactionBtn
                                            icon={Zap}
                                            color="#FF2D55"
                                            isActive={userReaction === 'crazy'}
                                            count={reactionCounts.crazy}
                                            onPress={() => handleReaction('crazy')}
                                        />
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                )}
            </Modal>

        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  safeAreaContainer: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingHorizontal: 15, paddingVertical: 10, alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
  closeBtn: { padding: 5, backgroundColor: '#F0F0F0', borderRadius: 20 },
  closeBtnTransparent: { padding: 5, backgroundColor: 'transparent' },
  
  profileBlock: { 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#FFF'
  },
  profileInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
  },
  profileAvatar: { 
      width: 70, 
      height: 70, 
      borderRadius: 35,
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
      fontSize: 20, 
      fontWeight: '900', 
      color: '#000',
      marginBottom: 4
  },
  bio: { 
      fontSize: 13, 
      color: '#666',
      lineHeight: 18
  },

  iconOnlyBtn: {
      width: 44, 
      height: 44, 
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EEE', 
      borderRadius: 12,
  },
  followingBtn: {
      backgroundColor: '#FFF', 
      borderWidth: 2,
      borderColor: '#000'
  },
  unblockBtn: {
      backgroundColor: '#FF3B30', 
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: '#999', fontSize: 16 },
  
  blockedState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: -50 
  },
  blockedSubText: {
      color: '#666',
      fontSize: 14,
  },

  missedOverlay: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: 'rgba(255,255,255,0.4)' 
  },
  missedDate: { 
      fontSize: 16, 
      fontWeight: '700', 
      color: '#000', 
      backgroundColor: 'rgba(255,255,255,0.8)', 
      paddingHorizontal: 8, 
      paddingVertical: 2, 
      borderRadius: 4, 
      overflow: 'hidden' 
  },

  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
  
  modalContainer: { flex: 1, backgroundColor: '#FFF' }, // Base blanche mais modale interne transparente
  modalHeader: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, paddingTop: 10, backgroundColor: 'transparent', zIndex: 20 },

  // Styles Feed Card pour l'uniformité (Blanc sur fond sombre)
  infoCard: {
      width: '100%',
      padding: 20, 
      backgroundColor: 'transparent', // Fond transparent
      borderTopWidth: 0, // Plus de bordure
      marginTop: 10 
  },
  infoContent: {
      alignItems: 'center'
  },
  titleRow: { 
      width: '100%',
      flexDirection: 'row', 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginBottom: 2,
      position: 'relative'
  },
  drawingTitle: { 
      fontSize: 26, 
      fontWeight: '900', 
      color: '#FFF', // Titre blanc
      letterSpacing: -0.5, 
      textAlign: 'center',
      maxWidth: '80%' 
  },
  moreBtnAbsolute: { 
      position: 'absolute',
      right: 0,
      top: 5,
      padding: 5 
  },
  userName: { 
      fontSize: 13, 
      fontWeight: '500', 
      color: 'rgba(255,255,255,0.8)', // Nom gris clair
      marginBottom: 10
  },
  reactionBar: { 
      flexDirection: 'row', 
      justifyContent: 'space-around', 
      alignItems: 'center', 
      width: '100%',
      paddingHorizontal: 10
  },
  reactionBtn: { 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 8
  },
  reactionText: { 
      fontSize: 12, 
      fontWeight: '700', 
      color: '#999',
      marginTop: 4 
  },
  activeText: {
      color: '#000',
      fontWeight: '900'
  }
});