import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable, Alert, PixelRatio, Share } from 'react-native';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { User, Eye, MoreHorizontal, Heart, ChevronLeft, ChevronRight, Share2, CircleHelp } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { useAuth } from '../../src/contexts/AuthContext';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
import Carousel from 'react-native-reanimated-carousel';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { SafeAreaView } from 'react-native-safe-area-context';
import { SunbimHeader } from '../../src/components/SunbimHeader';
// Import du nouveau composant ShareModal
import { ShareModal } from '../../src/components/ShareModal';

// Types de réactions possibles (Modifié : seulement like et question)
type ReactionType = 'like' | 'question' | null;

// --- COMPOSANT BACKGROUND : MIROIR + FLOU + FONDU ÉTENDU ---
const MirroredBackground = ({ uri, width, height, top }: { uri: string, width: number, height: number, top: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const bottom = top + height;
    const BLUR_RADIUS = 25; 

    // 🔥 CORRECTION BORDS BLANCS
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

const FeedCard = memo(({ drawing, canvasSize, index, currentIndex, onUserPress, isHolding }: { drawing: any, canvasSize: number, index: number, currentIndex: number, onUserPress: (user: any) => void, isHolding: boolean }) => {
    const { user } = useAuth();
    
    const [userReaction, setUserReaction] = useState<ReactionType>(null);
    const [reactionCounts, setReactionCounts] = useState({
        like: 0,
        question: 0
    });
    
    const [isShareModalVisible, setShareModalVisible] = useState(false);

    const author = drawing.users;
    const isActive = index === currentIndex; 
    const shouldRenderDrawing = isActive;

    const optimizedDrawingUri = useMemo(() => {
        if (!drawing.cloud_image_url) return null;
        const w = Math.round(canvasSize * PixelRatio.get());
        const h = Math.round(w * (4/3)); 
        return getOptimizedImageUrl(drawing.cloud_image_url, w, h);
    }, [drawing.cloud_image_url, canvasSize]);

    useEffect(() => {
        fetchReactionsState();
    }, [drawing.id]); 

    const fetchReactionsState = async () => {
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
                if (user && r.user_id === user.id) {
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
        if (!user || !type) return;

        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };
        
        let newReaction: ReactionType = type;
        let newCounts = { ...reactionCounts };

        if (userReaction === type) {
            newReaction = null;
            newCounts[type] = Math.max(0, newCounts[type] - 1);
        } 
        else {
            if (previousReaction) {
                newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
            }
            newCounts[type]++;
        }

        setUserReaction(newReaction);
        setReactionCounts(newCounts);

        try {
            if (newReaction === null) {
                const { error } = await supabase
                    .from('reactions')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('drawing_id', drawing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('reactions')
                    .upsert({
                        user_id: user.id,
                        drawing_id: drawing.id,
                        reaction_type: newReaction
                    }, { onConflict: 'user_id, drawing_id' });
                
                if (error) throw error;
            }
        } catch (e) {
            console.error("Error updating reaction:", e);
            setUserReaction(previousReaction);
            setReactionCounts(previousCounts);
            Alert.alert("Oops", "Could not save reaction.");
        }
    };

    const handleReport = () => {
        Alert.alert(
            "Options",
            "What do you want to do?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Report content", 
                    onPress: async () => {
                        if (!user) return Alert.alert("Error", "You must be logged in to report.");
                        try {
                            const { error } = await supabase
                                .from('reports')
                                .insert({ reporter_id: user.id, drawing_id: drawing.id, reason: 'Inappropriate content' });
                            
                            if (error) throw error;
                            Alert.alert("Report sent", "We will review this image. Thank you for your vigilance.");
                        } catch (e) {
                            console.error(e);
                            Alert.alert("Error", "Could not send report.");
                        }
                    }
                },
                { 
                    text: "Block user", 
                    style: 'destructive', 
                    onPress: async () => {
                        if (!user) return Alert.alert("Error", "You must be logged in to block.");
                        try {
                            const { error } = await supabase
                                .from('blocks')
                                .insert({ blocker_id: user.id, blocked_id: author.id });
                            
                            if (error) throw error;
                            Alert.alert("User blocked", "You will no longer see content from this user.");
                        } catch (e: any) {
                            if (e.code === '23505') { 
                                 Alert.alert("Info", "You have already blocked this user.");
                            } else {
                                console.error(e);
                                Alert.alert("Error", "Could not block user.");
                            }
                        }
                    }
                }
            ]
        );
    };

    // 🔥 GESTION DU PARTAGE (SHARE) DANS LA CARTE AVEC MODALE IMMERSIVE
    const handleShare = () => {
        setShareModalVisible(true);
    };

    return (
        <View style={styles.cardContainer}>
            <View style={{ width: canvasSize, height: canvasSize * (4/3), backgroundColor: 'transparent', position: 'relative' }}>
                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                    {shouldRenderDrawing && (
                        <DrawingViewer
                            key={`${drawing.id}-${isActive}`} 
                            imageUri={optimizedDrawingUri || drawing.cloud_image_url}
                            canvasData={drawing.canvas_data}
                            viewerSize={canvasSize}
                            viewerHeight={canvasSize * (4/3)}
                            transparentMode={true} 
                            animated={isActive} 
                            startVisible={false} 
                            autoCenter={false}
                        />
                    )}
                </View>
            </View>
            
            <View style={styles.cardInfo}>
                <View style={styles.headerInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.drawingTitle} numberOfLines={1}>
                            {drawing.label || "Untitled"}
                        </Text>
                    </View>

                    <TouchableOpacity 
                        onPress={() => onUserPress(author)} 
                        activeOpacity={0.7}
                        style={styles.authorContainer}
                    >
                         <Text style={styles.userName}>{author?.display_name || "Anonymous"}</Text>
                    </TouchableOpacity>

                    {/* BARRE D'ACTIONS COMPLÈTE (Partage - Réactions - Options) */}
                    <View style={styles.reactionBar}>
                        {/* 1. Partage à gauche */}
                        <TouchableOpacity onPress={handleShare} style={styles.actionBtn} hitSlop={15}>
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
                </View>
            </View>

            {/* Utilisation de la nouvelle modale de partage */}
            <ShareModal 
                visible={isShareModalVisible} 
                onClose={() => setShareModalVisible(false)} 
                drawing={drawing} 
            />
        </View>
    );
}, (prev, next) => {
    return prev.drawing.id === next.drawing.id && 
           prev.index === next.index && 
           prev.currentIndex === next.currentIndex &&
           prev.isHolding === next.isHolding; 
});

export default function FeedPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useLocalSearchParams(); 
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    const [showTutorialArrows, setShowTutorialArrows] = useState(true);
    const [isGlobalHolding, setIsGlobalHolding] = useState(false);
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

    const isSmallScreen = screenHeight < 700;
    const TOP_HEADER_SPACE = isSmallScreen ? 80 : 120;
    const MAX_IMAGE_HEIGHT = screenHeight - TOP_HEADER_SPACE - 150; 
    const IDEAL_HEIGHT = screenWidth * (4/3);
    const FINAL_IMAGE_HEIGHT = Math.min(IDEAL_HEIGHT, MAX_IMAGE_HEIGHT);
    const FINAL_IMAGE_WIDTH = FINAL_IMAGE_HEIGHT * (3/4);
    
    const EYE_BUTTON_SIZE = 44;
    const MARGIN_BOTTOM = 25; 
    const eyeButtonTop = TOP_HEADER_SPACE + FINAL_IMAGE_HEIGHT - EYE_BUTTON_SIZE - MARGIN_BOTTOM;

    useFocusEffect(
        useCallback(() => {
            fetchTodaysFeed();
        }, [user])
    );

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (!cloudData) {
                setLoading(false);
                return;
            }

            if (user && !params.justPosted) { 
                const { data: myDrawing } = await supabase
                    .from('drawings')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('cloud_id', cloudData.id)
                    .maybeSingle();
                
                if (!myDrawing) {
                    router.replace('/'); 
                    return; 
                }
            }

            if (cloudData) {
                setBackgroundCloud(cloudData.image_url);

                let blockedUserIds: string[] = [];
                let reportedDrawingIds: string[] = []; // Liste des dessins signalés par moi

                if (user) {
                    // 1. Récupération des utilisateurs bloqués
                    const { data: blocks } = await supabase
                        .from('blocks')
                        .select('blocked_id')
                        .eq('blocker_id', user.id);
                    
                    if (blocks && blocks.length > 0) {
                        blockedUserIds = blocks.map(b => b.blocked_id);
                    }

                    // 2. Récupération des dessins signalés par moi
                    const { data: reports } = await supabase
                        .from('reports')
                        .select('drawing_id')
                        .eq('reporter_id', user.id);
                    
                    if (reports && reports.length > 0) {
                        reportedDrawingIds = reports.map(r => r.drawing_id);
                    }
                }

                // Modification ici : on demande les reports pour compter dynamiquement
                let query = supabase
                    .from('drawings')
                    .select('*, users(id, display_name, avatar_url), reports(id)') 
                    .eq('cloud_id', cloudData.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                // Exclusion des utilisateurs bloqués
                if (blockedUserIds.length > 0) {
                    query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
                }

                // Exclusion des dessins signalés par l'utilisateur connecté
                if (reportedDrawingIds.length > 0) {
                    query = query.not('id', 'in', `(${reportedDrawingIds.join(',')})`);
                }

                const { data: drawingsData, error: drawingsError } = await query;

                if (drawingsError) throw drawingsError;

                // --- FILTRAGE DYNAMIQUE CLIENT ---
                // On ne garde que les dessins qui ont moins de 2 signalements
                const safeDrawings = (drawingsData || []).filter((drawing: any) => {
                    const reportCount = drawing.reports ? drawing.reports.length : 0;
                    return reportCount < 2;
                });

                setDrawings(safeDrawings);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleUserPress = (targetUser: any) => {
        if (!targetUser) return;
        if (user && targetUser.id === user.id) {
            router.push('/(tabs)/profile');
        } else {
            setSelectedUser(targetUser);
            setIsProfileModalVisible(true);
        }
    };

    const optimizedBackground = useMemo(() => {
        if (!backgroundCloud) return null;
        const physicalWidth = Math.round(screenWidth * PixelRatio.get());
        const physicalHeight = Math.round(physicalWidth * (4/3));
        return getOptimizedImageUrl(backgroundCloud, physicalWidth, physicalHeight);
    }, [backgroundCloud, screenWidth]);


    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#000" size="large" /></View>;

    return (
        <View style={styles.container}>
            {backgroundCloud && (
                <MirroredBackground 
                    uri={optimizedBackground || backgroundCloud}
                    width={screenWidth}
                    height={FINAL_IMAGE_HEIGHT} 
                    top={TOP_HEADER_SPACE} 
                />
            )}

            <SunbimHeader showCloseButton={false} transparent={true} />
            
            <View 
                style={[styles.mainContent, { paddingTop: TOP_HEADER_SPACE }]} 
                onLayout={(e) => setLayout(e.nativeEvent.layout)}
            >
                {drawings.length > 0 && layout ? (
                    <View style={{ alignItems: 'center' }}>
                    <Carousel
                        loop={true}
                        width={screenWidth} 
                        height={FINAL_IMAGE_HEIGHT + 150} 
                        autoPlay={false}
                        data={drawings}
                        scrollAnimationDuration={500}
                        onSnapToItem={(index) => {
                            setCurrentIndex(index);
                            setShowTutorialArrows(false);
                        }}
                        renderItem={({ item, index }) => (
                            <View style={{ alignItems: 'center' }}>
                                <FeedCard 
                                    drawing={item} 
                                    canvasSize={FINAL_IMAGE_WIDTH} 
                                    index={index}
                                    currentIndex={currentIndex}
                                    onUserPress={handleUserPress}
                                    isHolding={isGlobalHolding && index === currentIndex}
                                />
                            </View>
                        )}
                    />
                    </View>
                ) : (
                    !loading && drawings.length === 0 ? (
                        <View style={styles.centerBox}><Text style={styles.text}>The gallery is empty.</Text></View>
                    ) : null
                )}

                {showTutorialArrows && drawings.length > 1 && (
                    <View style={[styles.tutorialArrowsContainer, { top: TOP_HEADER_SPACE, height: FINAL_IMAGE_HEIGHT }]} pointerEvents="none">
                        <View style={styles.arrowBox}>
                            <ChevronLeft color="rgba(255,255,255,0.7)" size={48} />
                        </View>
                        <View style={styles.arrowBox}>
                            <ChevronRight color="rgba(255,255,255,0.7)" size={48} />
                        </View>
                    </View>
                )}

                {drawings.length > 0 && (
                    <TouchableOpacity 
                        style={[
                            styles.staticEyeBtn, 
                            { top: eyeButtonTop } 
                        ]}
                        activeOpacity={0.8}
                        onPressIn={() => setIsGlobalHolding(true)}
                        onPressOut={() => setIsGlobalHolding(false)}
                    >
                        <Eye color="#000" size={24} />
                    </TouchableOpacity>
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
    container: { flex: 1, backgroundColor: '#ffffffff' }, 
    loadingContainer: { flex: 1, backgroundColor: '#ffffffff', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#FFF', fontSize: 16 }, 
    
    // Header custom supprimé, retour au SunbimHeader standard via composant
    
    mainContent: {
        flex: 1,
        position: 'relative',
        alignItems: 'center' 
    },

    cardContainer: { 
        justifyContent: 'flex-start',
        alignItems: 'center' 
    }, 
    cardInfo: {
        width: '100%', 
        backgroundColor: 'transparent', 
        marginTop: 0, 
        paddingHorizontal: 20, 
        paddingTop: 10,
        shadowColor: "transparent", 
        elevation: 0,
    },
    headerInfo: { 
        marginBottom: 0, 
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
        maxWidth: '90%'
    },
    
    staticEyeBtn: {
        position: 'absolute',
        right: 15,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.5)', 
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100, 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4
    },
    
    authorContainer: {
        marginTop: 0 
    },
    userName: { 
        fontSize: 13, 
        fontWeight: '600', 
        color: 'rgba(255,255,255,0.8)', 
        marginBottom: 4
    },

    reactionBar: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', // Alignement vers le haut pour compenser la hauteur du texte
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
        paddingTop: 6, // Padding ajusté pour aligner l'icône 24px avec l'icône 28px
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

    tutorialArrowsContainer: {
        position: 'absolute',
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        zIndex: 50,
    },
    arrowBox: {
        opacity: 0.8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 5
    }
});