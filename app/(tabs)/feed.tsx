import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable, Alert, PixelRatio } from 'react-native';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { User, Eye, MoreHorizontal, Lightbulb, Palette, Laugh, Heart, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
import Carousel from 'react-native-reanimated-carousel';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

// --- COMPOSANT BACKGROUND : MIROIR + FLOU + FONDU ÉTENDU ---
const MirroredBackground = ({ uri, width, height, top }: { uri: string, width: number, height: number, top: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const bottom = top + height;
    const BLUR_RADIUS = 25; 

    // 🔥 CORRECTION BORDS BLANCS : 
    // On dessine l'arrière-plan (couche floue) plus large que l'écran pour que le flou 
    // ne crée pas de transparence sur les bords gauche/droite visibles.
    const EXTRA_WIDTH = 100; // 50px de marge de chaque côté pour absorber le flou
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2; // On décale vers la gauche pour centrer l'image élargie

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            
            {/* 1. ARRIÈRE-PLAN : MIROIRS + FLOU (Remplissage total avec débordement)
                On utilise bgX et bgWidth pour déborder de l'écran.
            */}
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                {/* Image centrale */}
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />

                {/* Miroir Haut */}
                <Group origin={vec(width / 2, top)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>

                {/* Miroir Bas */}
                <Group origin={vec(width / 2, bottom)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>

            {/* 2. PREMIER-PLAN : IMAGE NETTE AVEC MASQUE
                Ici on reste à la taille exacte de l'écran (width) pour l'alignement parfait.
            */}
            <Mask
                mode="luminance"
                mask={
                    <Rect x={0} y={top} width={width} height={height}>
                        <SkiaGradient
                            start={vec(0, top)}
                            end={vec(0, bottom)}
                            // Noir = Transparent, Blanc = Visible
                            colors={["black", "white", "white", "black"]}
                            // 🔥 CORRECTION FONDU : Zone agrandie à 20% (0.2) au lieu de 10%
                            // positions correspond à : [début fondu haut, fin fondu haut, début fondu bas, fin fondu bas]
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

// --- LE RESTE DU CODE (SANS CHANGEMENT MAJEUR) ---

const AnimatedReactionBtn = ({ onPress, isActive, icon: Icon, color }: any) => {
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

const FeedCard = memo(({ drawing, canvasSize, index, currentIndex, onUserPress, isHolding }: { drawing: any, canvasSize: number, index: number, currentIndex: number, onUserPress: (user: any) => void, isHolding: boolean }) => {
    const { user } = useAuth();
    
    const [userReaction, setUserReaction] = useState<ReactionType>(null);
    const [reactionCounts, setReactionCounts] = useState({
        like: 0,
        smart: 0,
        beautiful: 0,
        crazy: 0
    });
    
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

            const counts = { like: 0, smart: 0, beautiful: 0, crazy: 0 };
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
            console.error("Erreur chargement réactions:", e);
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
            console.error("Erreur mise à jour réaction:", e);
            setUserReaction(previousReaction);
            setReactionCounts(previousCounts);
            Alert.alert("Oups", "Impossible d'enregistrer la réaction.");
        }
    };

    const handleReport = () => {
        Alert.alert(
            "Options",
            "Que souhaitez-vous faire ?",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Signaler le contenu", 
                    onPress: async () => {
                        if (!user) return Alert.alert("Erreur", "Vous devez être connecté pour signaler.");
                        try {
                            const { error } = await supabase
                                .from('reports')
                                .insert({ reporter_id: user.id, drawing_id: drawing.id, reason: 'Contenu inapproprié' });
                            
                            if (error) throw error;
                            Alert.alert("Signalement envoyé", "Nous allons examiner cette image. Merci de votre vigilance.");
                        } catch (e) {
                            console.error(e);
                            Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
                        }
                    }
                },
                { 
                    text: "Bloquer l'utilisateur", 
                    style: 'destructive', 
                    onPress: async () => {
                        if (!user) return Alert.alert("Erreur", "Vous devez être connecté pour bloquer.");
                        try {
                            const { error } = await supabase
                                .from('blocks')
                                .insert({ blocker_id: user.id, blocked_id: author.id });
                            
                            if (error) throw error;
                            Alert.alert("Utilisateur bloqué", "Vous ne verrez plus les contenus de cet utilisateur.");
                        } catch (e: any) {
                            if (e.code === '23505') { 
                                 Alert.alert("Info", "Vous avez déjà bloqué cet utilisateur.");
                            } else {
                                console.error(e);
                                Alert.alert("Erreur", "Impossible de bloquer l'utilisateur.");
                            }
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.cardContainer}>
            {/* 🔥 CORRECTION PETITS ÉCRANS : 
               On s'assure que le conteneur du dessin a une taille fixe ou relative qui ne déborde pas.
               Dans le carrousel, on utilise width=canvasSize.
            */}
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
                            {drawing.label || "Sans titre"}
                        </Text>
                        
                        <TouchableOpacity onPress={handleReport} style={styles.moreBtnAbsolute} hitSlop={15}>
                            <MoreHorizontal color="#CCC" size={24} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        onPress={() => onUserPress(author)} 
                        activeOpacity={0.7}
                        style={styles.authorContainer}
                    >
                         <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>
                    </TouchableOpacity>

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
                            icon={Laugh} 
                            color="#FF2D55" 
                            isActive={userReaction === 'crazy'} 
                            count={reactionCounts.crazy} 
                            onPress={() => handleReaction('crazy')}
                        />
                    </View>
                </View>
            </View>
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
    
    // 🔥 ETAT POUR AFFICHER LES FLÈCHES DE TUTO
    const [showTutorialArrows, setShowTutorialArrows] = useState(true);
    
    const [isGlobalHolding, setIsGlobalHolding] = useState(false);
    
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

    // Ajustement dynamique de l'espace haut pour petits écrans
    const isSmallScreen = screenHeight < 700;
    const TOP_HEADER_SPACE = isSmallScreen ? 80 : 120;

    // Calcul hauteur image : si 4/3 dépasse l'écran dispo, on réduit
    // L'écran dispo = screenHeight - TOP_HEADER_SPACE - Bottom nav (approx 80)
    // On veut garder un peu de marge en bas pour les infos
    const MAX_IMAGE_HEIGHT = screenHeight - TOP_HEADER_SPACE - 150; // 150px pour infos + marge
    const IDEAL_HEIGHT = screenWidth * (4/3);
    
    const FINAL_IMAGE_HEIGHT = Math.min(IDEAL_HEIGHT, MAX_IMAGE_HEIGHT);
    // Si on réduit la hauteur, on doit ajuster la largeur pour garder le ratio, 
    // OU accepter que l'image soit plus petite (contain)
    // Ici on va ajuster le carrousel. 
    // Si l'image est plus petite que screenWidth en largeur, on centre.
    
    const FINAL_IMAGE_WIDTH = FINAL_IMAGE_HEIGHT * (3/4);
    
    // Position du bouton oeil relative à la nouvelle hauteur
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
                if (user) {
                    const { data: blocks } = await supabase
                        .from('blocks')
                        .select('blocked_id')
                        .eq('blocker_id', user.id);
                    
                    if (blocks && blocks.length > 0) {
                        blockedUserIds = blocks.map(b => b.blocked_id);
                    }
                }

                let query = supabase
                    .from('drawings')
                    .select('*, users(id, display_name, avatar_url)') 
                    .eq('cloud_id', cloudData.id)
                    .eq('is_hidden', false) 
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (blockedUserIds.length > 0) {
                    query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
                }

                const { data: drawingsData, error: drawingsError } = await query;

                if (drawingsError) throw drawingsError;
                setDrawings(drawingsData || []);
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
                    height={FINAL_IMAGE_HEIGHT} // On utilise la hauteur calculée
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
                        width={screenWidth} // Le carrousel prend toute la largeur
                        height={FINAL_IMAGE_HEIGHT + 150} // Hauteur image + espace infos
                        autoPlay={false}
                        data={drawings}
                        scrollAnimationDuration={500}
                        onSnapToItem={(index) => {
                            setCurrentIndex(index);
                            setShowTutorialArrows(false);
                        }}
                        renderItem={({ item, index }) => (
                            <View style={{ alignItems: 'center' }}>
                                {/* On centre la carte dans le carrousel */}
                                <FeedCard 
                                    drawing={item} 
                                    canvasSize={FINAL_IMAGE_WIDTH} // On passe la largeur adaptée
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
                        <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
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
    
    mainContent: {
        flex: 1,
        position: 'relative',
        alignItems: 'center' // Centrer le contenu horizontalement
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
        position: 'relative'
    },
    drawingTitle: { 
        fontSize: 26, 
        fontWeight: '900', 
        color: '#FFF', 
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
        justifyContent: 'center', 
        alignItems: 'center', 
        width: '100%',
        gap: 40,
        paddingHorizontal: 10,
        paddingBottom: 20,
        marginTop: 4
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