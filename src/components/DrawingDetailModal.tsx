import React, { useState, useEffect, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Alert, Pressable, Platform, ScrollView, PixelRatio, Image } from 'react-native';
import { X, Heart, Lightbulb, Palette, Zap, MoreHorizontal, Share2, AlertCircle, CircleHelp } from 'lucide-react-native';
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

// Types de réactions possibles (Modifié : seulement like et question)
type ReactionType = 'like' | 'question' | null;

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
const AnimatedReactionBtn = ({ onPress, isActive, icon: Icon, color, count, isCustomIcon, customContent }: any) => {
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
                {isCustomIcon ? (
                    <Text style={{ fontSize: 28, fontWeight: '900', color: isActive ? color : "#FFF", textAlign: 'center' }}>
                        {customContent}
                    </Text>
                ) : (
                    <Icon
                        color={isActive ? color : "#FFF"}
                        fill={isActive ? color : "transparent"}
                        size={28}
                    />
                )}
            </Animated.View>
            <Text style={[styles.reactionText, isActive && styles.activeText]}>
                {count > 0 ? count : ''}
            </Text>
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
      question: 0
  });

  const { width: screenWidth } = Dimensions.get('window');

  // Si userProfile n'est pas passé, on essaie de le prendre depuis drawing.users (cas standard)
  const author = userProfile || drawing?.users;
  const isMissed = drawing?.type === 'missed';

  useEffect(() => {
    if (visible && drawing) {
        if (!isMissed) fetchReactionsState();
        setAnimationReady(false);
        const timer = setTimeout(() => {
            setAnimationReady(true);
        }, 500); 
        return () => clearTimeout(timer);
    } else {
        setAnimationReady(false);
        setUserReaction(null);
        setReactionCounts({ like: 0, question: 0 });
    }
  }, [visible, drawing]);

  const optimizedModalImageUri = useMemo(() => {
    if (!drawing?.cloud_image_url) return null;
    const w = Math.round(screenWidth * PixelRatio.get());
    const h = Math.round(w * (4/3));
    return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
  }, [drawing, screenWidth]);

  const fetchReactionsState = async () => {
        if (!drawing || isMissed) return;
        try {
            const { data: allReactions, error } = await supabase
                .from('reactions')
                .select('reaction_type, user_id')
                .eq('drawing_id', drawing.id);

            if (error) throw error;

            const counts = { like: 0, question: 0 };
            let myReaction: ReactionType = null;

            allReactions?.forEach((r: any) => {
                const type = r.reaction_type as keyof typeof counts;
                if (counts.hasOwnProperty(type)) {
                    counts[type]++;
                }
                if (currentUser && r.user_id === currentUser.id) {
                    myReaction = type;
                }
            });

            setReactionCounts(counts);
            setUserReaction(myReaction);

        } catch (e) {
            console.error("Error loading reactions:", e);
        }
  };

  const handleReaction = async (type: ReactionType) => {
        if (!currentUser || !type || !drawing || isMissed) return;

        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };

        // Optimistic UI update
        if (userReaction === type) {
            setUserReaction(null);
            setReactionCounts(prev => {
                const newCounts = { ...prev };
                newCounts[type] = Math.max(0, newCounts[type] - 1);
                return newCounts;
            });
            
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
    if (!drawing || isMissed) return;
    Alert.alert(
        "Options",
        "What do you want to do?",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Report content", 
                onPress: async () => {
                    if (!currentUser) return Alert.alert("Error", "You must be logged in to report.");
                    try {
                        const { error } = await supabase
                            .from('reports')
                            .insert({ reporter_id: currentUser.id, drawing_id: drawing.id, reason: 'Inappropriate content' });
                        
                        if (error) throw error;
                        Alert.alert("Report sent", "We will review this image. Thank you for your vigilance.");
                    } catch (e) {
                        console.error(e);
                        Alert.alert("Error", "Could not send report.");
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
                            if (isUnlocked && !isMissed) setIsHolding(true);
                        }} 
                        onPressOut={() => setIsHolding(false)}
                        style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: 'transparent', marginTop: 0 }}
                        disabled={isMissed}
                    >
                        <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                            {isMissed ? (
                                <View style={{ flex: 1 }}>
                                    <Image
                                        source={{ uri: optimizedModalImageUri || drawing.cloud_image_url }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.missedOverlay}>
                                        <AlertCircle color="#000" size={64} style={{ marginBottom: 10 }} />
                                        <Text style={styles.missedDate}>
                                            {new Date(drawing.date).toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                                        </Text>
                                        <Text style={styles.missedText}>Day missed</Text>
                                    </View>
                                </View>
                            ) : (
                                animationReady ? (
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
                                )
                            )}
                        </View>
                        {isUnlocked && !isMissed && <Text style={styles.hintText}> </Text>}
                    </Pressable>
                </View>

                {/* Infos Dessin & Auteur (Masqués ou adaptés si Jour Manqué) */}
                <View style={styles.infoCard}>
                    <View style={styles.infoContent}>
                        <View style={styles.titleRow}>
                            <Text style={styles.drawingTitle} numberOfLines={1}>
                                {isMissed ? "No drawing" : (drawing.label || "Untitled")}
                            </Text>
                        </View>
                        
                        <Text style={styles.userName}>
                            {isMissed ? "" : (author?.display_name || "Anonymous")}
                        </Text>

                        {/* Barre de réactions - Cachée si manqué */}
                        {!isMissed && (
                            <View style={styles.reactionBar}>
                                {/* 1. Partage à gauche */}
                                <TouchableOpacity onPress={openShareModal} style={styles.actionBtn} hitSlop={15}>
                                    <Share2 color="#CCC" size={24} />
                                </TouchableOpacity>

                                {/* 2. Réactions au centre */}
                                <View style={styles.reactionsCenter}>
                                    <AnimatedReactionBtn
                                        icon={Heart}
                                        color="#FF3B30"
                                        isActive={userReaction === 'like'}
                                        count={reactionCounts.like}
                                        onPress={() => handleReaction('like')}
                                    />
                                    <AnimatedReactionBtn
                                        isCustomIcon={true}
                                        customContent="?"
                                        color="#FFCC00"
                                        isActive={userReaction === 'question'}
                                        count={reactionCounts.question}
                                        onPress={() => handleReaction('question')}
                                    />
                                </View>

                                {/* 3. Options à droite */}
                                <TouchableOpacity onPress={handleReport} style={styles.actionBtn} hitSlop={15}>
                                    <MoreHorizontal color="#CCC" size={24} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* MODALE DE PARTAGE */}
            <ShareModal 
                visible={isShareModalVisible}
                onClose={() => setShareModalVisible(false)}
                drawing={drawing}
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
      justifyContent: 'space-between', 
      alignItems: 'flex-start',
      width: '100%',
      paddingHorizontal: 20,
      paddingBottom: 20,
      marginTop: 10
  },
  reactionsCenter: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 60, 
  },
  actionBtn: {
      paddingTop: 6,
      paddingHorizontal: 5,
      paddingBottom: 5
  },
  reactionBtn: { 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 4
  },
  reactionText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4
  },
  activeText: {
    color: '#FFF',
    fontWeight: '900'
  },
  missedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  missedDate: {
      fontSize: 24,
      fontWeight: '900',
      color: '#000',
      backgroundColor: 'rgba(255,255,255,0.8)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 10
  },
  missedText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#000',
      marginTop: 5
  }
});