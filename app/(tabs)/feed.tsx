import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable, Alert } from 'react-native';
import { useEffect, useState, memo, useCallback } from 'react'; // Ajout de useCallback manquant
import { User, Eye, MoreHorizontal, Lightbulb, Palette, Zap, Heart } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router'; // Ajout de useLocalSearchParams
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
import Carousel from 'react-native-reanimated-carousel';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
// On utilise Skia pour le masquage avancé (fondu transparent)
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage } from "@shopify/react-native-skia";

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

// --- COMPOSANT IMAGE MASQUÉE (FONDU BORDS) ---
const MaskedDayImage = ({ uri, width, height, top }: { uri: string, width: number, height: number, top: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    return (
        <Canvas style={{ position: 'absolute', top, left: 0, width, height, zIndex: 0 }} pointerEvents="none">
             {/* 1. Le Masque (Dégradé d'opacité) */}
             <Rect x={0} y={0} width={width} height={height}>
                <SkiaGradient
                    start={vec(0, 0)}
                    end={vec(0, height)}
                    // Transparent aux extrémités, Opaque (blanc) au centre
                    colors={["transparent", "white", "white", "transparent"]}
                    // Le fondu se fait sur les 10% du haut et du bas
                    positions={[0, 0.10, 0.90, 1]}
                />
            </Rect>
            {/* 2. L'Image (Source) - Affichée uniquement là où le masque est opaque */}
            <SkiaImage
                image={image}
                x={0} y={0} width={width} height={height}
                fit="cover"
                blendMode="srcIn" 
            />
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
                    color={isActive ? color : "#000"} 
                    fill={isActive ? color : "transparent"} 
                    size={24} 
                />
            </Animated.View>
            <Text style={[styles.reactionText, isActive && styles.activeText]}>
                {count || 0}
            </Text>
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
            <View style={{ width: canvasSize, height: canvasSize * (4/3), backgroundColor: 'transparent', position: 'relative' }}>
                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                    {shouldRenderDrawing && (
                        <DrawingViewer
                            key={`${drawing.id}-${isActive}`} 
                            imageUri={drawing.cloud_image_url}
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
                </View>

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
    const params = useLocalSearchParams(); // Pour récupérer 'justPosted'
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);
    const { width: screenWidth } = Dimensions.get('window');
    
    const [isGlobalHolding, setIsGlobalHolding] = useState(false);
    
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

    const TOP_HEADER_SPACE = 120;

    // Calculs de position
    const IMAGE_HEIGHT = screenWidth * (4/3);
    const EYE_BUTTON_SIZE = 44;
    const MARGIN_BOTTOM = 25; 
    
    const eyeButtonTop = IMAGE_HEIGHT - EYE_BUTTON_SIZE - MARGIN_BOTTOM;

    // UseFocusEffect pour re-vérifier à chaque fois qu'on arrive sur la page
    useFocusEffect(
        useCallback(() => {
            fetchTodaysFeed();
        }, [user])
    );

    const fetchTodaysFeed = async () => {
        try {
            // Si on n'est pas connecté, on ne peut pas dessiner donc on peut voir le feed (mode invité)
            // OU ALORS : Est-ce que tu veux bloquer le feed aux non-dessinateurs connectés uniquement ?
            // La logique habituelle est : Si connecté, as-tu dessiné ? Si non -> Redirection.
            
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (!cloudData) {
                // Pas de nuage aujourd'hui ?
                setLoading(false);
                return;
            }

            // --- LOGIQUE DE REDIRECTION SI PAS DESSINÉ ---
            if (user && !params.justPosted) { // Si on vient de poster, on ignore la vérification pour éviter une boucle ou un faux positif dû au délai
                const { data: myDrawing } = await supabase
                    .from('drawings')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('cloud_id', cloudData.id)
                    .maybeSingle();
                
                if (!myDrawing) {
                    // Pas de dessin pour aujourd'hui -> Redirection vers l'accueil pour dessiner
                    // On utilise router.replace pour ne pas pouvoir revenir en arrière
                    router.replace('/'); 
                    return; 
                }
            }
            // ---------------------------------------------

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

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#000" size="large" /></View>;

    const optimizedBackground = backgroundCloud ? getOptimizedImageUrl(backgroundCloud, screenWidth) : null;

    return (
        <View style={styles.container}>
            <SunbimHeader showCloseButton={false} transparent={true} />
            
            <View 
                style={[styles.mainContent, { paddingTop: TOP_HEADER_SPACE }]} 
                onLayout={(e) => setLayout(e.nativeEvent.layout)}
            >
                {/* 2. Photo du jour NETTE AVEC BORDS FONDUS (Remplaçant l'Image standard) */}
                {backgroundCloud && (
                    <MaskedDayImage 
                        uri={optimizedBackground || backgroundCloud}
                        width={screenWidth}
                        height={IMAGE_HEIGHT}
                        top={TOP_HEADER_SPACE}
                    />
                )}

                {drawings.length > 0 && layout ? (
                    <Carousel
                        loop={true}
                        width={layout.width}
                        height={layout.height}
                        autoPlay={false}
                        data={drawings}
                        scrollAnimationDuration={500}
                        onSnapToItem={(index) => setCurrentIndex(index)}
                        renderItem={({ item, index }) => (
                            <FeedCard 
                                drawing={item} 
                                canvasSize={layout.width} 
                                index={index}
                                currentIndex={currentIndex}
                                onUserPress={handleUserPress}
                                isHolding={isGlobalHolding && index === currentIndex}
                            />
                        )}
                    />
                ) : (
                    !loading && drawings.length === 0 ? (
                        <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
                    ) : null
                )}

                {/* BOUTON OEIL STATIQUE */}
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
    container: { flex: 1, backgroundColor: '#87CEEB' }, 
    loadingContainer: { flex: 1, backgroundColor: '#87CEEB', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#FFF', fontSize: 16 }, 
    
    mainContent: {
        flex: 1,
        position: 'relative',
    },

    cardContainer: { flex: 1, justifyContent: 'flex-start' }, 
    cardInfo: {
        flex: 1, 
        backgroundColor: 'transparent', 
        marginTop: 0, 
        paddingHorizontal: 20, 
        paddingTop: 10,
        shadowColor: "transparent", 
        elevation: 0,
    },
    headerInfo: { marginBottom: 5, alignItems: 'center' }, 
    
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
        backgroundColor: 'rgba(255,255,255,0.9)', 
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
        marginBottom: 10
    },

    reactionBar: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        width: '100%',
        paddingHorizontal: 10,
        paddingBottom: 40 
    },
    reactionBtn: { 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 8
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
    }
});