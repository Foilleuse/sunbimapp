import React, { useState, useEffect, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Alert, Pressable, Platform, ScrollView, PixelRatio } from 'react-native';
import { X, Heart, Lightbulb, Palette, Zap, MoreHorizontal, Share2 } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { DrawingViewer } from './DrawingViewer';
import { useAuth } from '../contexts/AuthContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
// Ajout des imports d'animation et Skia
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { ShareModal } from './ShareModal';

interface DrawingDetailModalProps {
  visible: boolean;
  onClose: () => void;
  drawing: any;
  userProfile?: any; // Optionnel, si on veut forcer l'affichage d'un profil spécifique (ex: UserProfileModal)
  isUnlocked?: boolean; // Pour savoir si on peut voir le dessin original
}

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

// --- COMPOSANT BACKGROUND : MIROIR + FLOU + FONDU ÉTENDU ---
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

export const DrawingDetailModal: React.FC<DrawingDetailModalProps> = ({ visible, onClose, drawing, userProfile, isUnlocked = true }) => {
  const { user: currentUser } = useAuth();
  
  const [isHolding, setIsHolding] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  
  const [userReaction, setUserReaction] = useState<ReactionType>(null);
  const [reactionCounts, setReactionCounts] = useState({
      like: 0,
      smart: 0,
      beautiful: 0,
      crazy: 0
  });

  const { width: screenWidth } = Dimensions.get('window');

  // Si userProfile n'est pas passé, on essaie de le prendre depuis drawing.users (cas standard)
  const author = userProfile || drawing?.users;

  useEffect(() => {
    if (visible && drawing) {
        fetchReactionsState();
        setAnimationReady(false);
        const timer = setTimeout(() => {
            setAnimationReady(true);
        }, 500); 
        return () => clearTimeout(timer);
    } else {
        setAnimationReady(false);
        setUserReaction(null);
        setReactionCounts({ like: 0, smart: 0, beautiful: 0, crazy: 0 });
    }
  }, [visible, drawing]);

  const optimizedModalImageUri = useMemo(() => {
    if (!drawing?.cloud_image_url) return null;
    const w = Math.round(screenWidth * PixelRatio.get());
    const h = Math.round(w * (4/3));
    return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
  }, [drawing, screenWidth]);

  const fetchReactionsState = async () => {
        if (!drawing) return;
        try {
            const { data: allReactions, error } = await supabase
                .from('reactions')
                .select('reaction_type, user_id')
                .eq('drawing_id', drawing.id);

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
        if (!currentUser || !type || !drawing) return;

        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };

        // Optimistic UI update
        if (userReaction === type) {
            setUserReaction(null);
            setReactionCounts(prev => ({
                ...prev,
                [type]: Math.max(0, prev[type] - 1)
            }));
            
            try {
                await supabase.from('reactions').delete().eq('user_id', currentUser.id).eq('drawing_id', drawing.id);
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
                        drawing_id: drawing.id,
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
    if (!drawing) return;
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
                            .insert({ reporter_id: currentUser.id, drawing_id: drawing.id, reason: 'Contenu inapproprié' });
                        
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

  const openShareModal = () => {
      setShareModalVisible(true);
  };

  if (!drawing) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.modalContainer}>
            
            {/* FOND MIROIR GLOBAL */}
            <MirroredBackground 
                uri={optimizedModalImageUri || drawing.cloud_image_url}
                width={screenWidth}
                height={screenWidth * (4/3)}
                top={60} 
            />

            <ScrollView 
                contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header avec bouton fermer - Hauteur fixe 60 pour alignement */}
                <View style={[styles.header, { height: 60, paddingVertical: 0, paddingTop: 10, paddingHorizontal: 15, backgroundColor: 'transparent', width: '100%', justifyContent: 'center' }]}> 
                    <TouchableOpacity onPress={onClose} style={styles.closeBtnTransparent} hitSlop={15}>
                        <X color="#FFF" size={28} />
                    </TouchableOpacity>
                </View>

                {/* Zone Image + Dessin */}
                <View style={{ width: screenWidth, alignItems: 'center' }}> 
                    <Pressable 
                        onPressIn={() => {
                            if (isUnlocked) setIsHolding(true);
                        }} 
                        onPressOut={() => setIsHolding(false)}
                        style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: 'transparent', marginTop: 0 }}
                    >
                        <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                            {animationReady ? (
                                <DrawingViewer
                                    imageUri={optimizedModalImageUri || drawing.cloud_image_url} 
                                    canvasData={isUnlocked ? drawing.canvas_data : []}
                                    viewerSize={screenWidth} 
                                    viewerHeight={screenWidth * (4/3)} 
                                    transparentMode={true} 
                                    startVisible={false} 
                                    animated={true}
                                    autoCenter={false} 
                                />
                            ) : (
                                <View style={{ width: '100%', height: '100%' }} /> 
                            )}
                        </View>
                        {isUnlocked && <Text style={styles.hintText}>Maintenir pour voir l'original</Text>}
                    </Pressable>
                </View>

                {/* Infos Dessin & Auteur */}
                <View style={styles.infoCard}>
                    <View style={styles.infoContent}>
                        <View style={styles.titleRow}>
                            {/* BOUTON PARTAGE */}
                            <TouchableOpacity onPress={openShareModal} style={styles.iconBtnLeft} hitSlop={15}>
                                <Share2 color="#CCC" size={24} />
                            </TouchableOpacity>

                            <Text style={styles.drawingTitle} numberOfLines={1}>
                                {drawing.label || "Sans titre"}
                            </Text>
                            
                            <TouchableOpacity onPress={handleReport} style={styles.iconBtnRight} hitSlop={15}>
                                <MoreHorizontal color="#CCC" size={24} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>

                        {/* Barre de réactions */}
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

            {/* MODALE DE PARTAGE */}
            <ShareModal 
                visible={isShareModalVisible}
                onClose={() => setShareModalVisible(false)}
                drawing={drawing}
                author={author} // Passage explicite de l'auteur pour éviter "Anonyme"
            />
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  header: { alignItems: 'flex-end', borderBottomWidth: 0, borderColor: '#eee' }, 
  closeBtnTransparent: { padding: 5, backgroundColor: 'transparent' },
  
  hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },

  infoCard: {
      width: '100%',
      padding: 20, 
      backgroundColor: 'transparent',
      borderTopWidth: 0,
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
      color: '#FFF',
      letterSpacing: -0.5, 
      textAlign: 'center',
      maxWidth: '70%' 
  },
  iconBtnLeft: {
      position: 'absolute',
      left: 0,
      top: 5,
      padding: 5
  },
  iconBtnRight: { 
      position: 'absolute',
      right: 0,
      top: 5,
      padding: 5 
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
      color: 'rgba(255,255,255,0.8)',
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
});