import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable, Alert } from 'react-native';
import { useEffect, useState, memo } from 'react';
import { User, Eye, MoreHorizontal, Lightbulb, Palette, Zap, Heart } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { useRouter } from 'expo-router'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
import Carousel from 'react-native-reanimated-carousel';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

// --- COMPOSANT BOUTON DE RÉACTION ANIMÉ ---
const AnimatedReactionBtn = ({ onPress, isActive, icon: Icon, color, count }: any) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePress = () => {
        // Animation de rebond
        scale.value = withSequence(
            withSpring(1.2, { damping: 2, stiffness: 80 }),
            withSpring(1, { damping: 2, stiffness: 80 })
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

// FeedCard ne gère plus le bouton Oeil
const FeedCard = memo(({ drawing, canvasSize, index, currentIndex, onUserPress, isHolding }: { drawing: any, canvasSize: number, index: number, currentIndex: number, onUserPress: (user: any) => void, isHolding: boolean }) => {
    const { user } = useAuth();
    
    // État local pour la réaction de l'utilisateur
    const [userReaction, setUserReaction] = useState<ReactionType>(null);
    
    // Compteurs locaux pour l'affichage immédiat
    const [reactionCounts, setReactionCounts] = useState({
        like: 0,
        smart: 0,
        beautiful: 0,
        crazy: 0
    });
    
    const author = drawing.users;
    const isActive = index === currentIndex; 
    const shouldRenderDrawing = isActive;

    // Chargement initial des réactions
    useEffect(() => {
        fetchReactionsState();
    }, [drawing.id]); // Dépendance sur l'ID du dessin pour recharger si la carte est recyclée

    const fetchReactionsState = async () => {
        try {
            // Récupérer toutes les réactions pour ce dessin
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

        // Optimistic UI Update
        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };
        
        let newReaction: ReactionType = type;
        let newCounts = { ...reactionCounts };

        // Si on clique sur la même réaction, on l'enlève (toggle off)
        if (userReaction === type) {
            newReaction = null;
            newCounts[type] = Math.max(0, newCounts[type] - 1);
        } 
        // Si on change de réaction ou qu'on en ajoute une nouvelle
        else {
            // Si on avait déjà une réaction différente, on décrémente l'ancienne
            if (previousReaction) {
                newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
            }
            // On incrémente la nouvelle
            newCounts[type]++;
        }

        // Appliquer les changements locaux immédiatement
        setUserReaction(newReaction);
        setReactionCounts(newCounts);

        try {
            if (newReaction === null) {
                // Suppression
                const { error } = await supabase
                    .from('reactions')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('drawing_id', drawing.id);
                if (error) throw error;
            } else {
                // Upsert (Insert ou Update)
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
            // Rollback en cas d'erreur
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

    const optimizedAvatar = author?.avatar_url ? getOptimizedImageUrl(author.avatar_url, 50) : null;

    return (
        <View style={styles.cardContainer}>
            
            <View style={{ width: canvasSize, aspectRatio: 3/4, backgroundColor: 'transparent', position: 'relative' }}>
                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                    {shouldRenderDrawing && (
                        <DrawingViewer
                            key={`${drawing.id}-${isActive}`} 
                            imageUri={drawing.cloud_image_url}
                            canvasData={drawing.canvas_data}
                            viewerSize={canvasSize}
                            transparentMode={true} 
                            animated={isActive} 
                            startVisible={false} 
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
                        
                        <TouchableOpacity 
                            onPress={handleReport} 
                            style={styles.moreBtnAbsolute}
                            hitSlop={15}
                        >
                            <MoreHorizontal color="#CCC" size={24} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.authorContainer}
                        onPress={() => onUserPress(author)} 
                        activeOpacity={0.7}
                    >
                         <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>
                    </TouchableOpacity>
                </View>

                {/* --- BARRE DE RÉACTIONS ANIMÉE --- */}
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
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);
    const { width: screenWidth } = Dimensions.get('window');
    
    // État global pour le maintien du bouton Oeil
    const [isGlobalHolding, setIsGlobalHolding] = useState(false);
    
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

    // Calcul de la hauteur de l'image (ratio 3:4)
    const IMAGE_HEIGHT = screenWidth * (4/3);
    const EYE_BUTTON_SIZE = 44;
    const CARD_OVERLAP = 40; 
    const MARGIN_BOTTOM = 15;
    
    const eyeButtonTop = IMAGE_HEIGHT - CARD_OVERLAP - MARGIN_BOTTOM - EYE_BUTTON_SIZE;

    useEffect(() => { fetchTodaysFeed(); }, [user]); 

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
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
            <SunbimHeader showCloseButton={false} />
            
            <View 
                style={{ flex: 1, position: 'relative' }} 
                onLayout={(e) => setLayout(e.nativeEvent.layout)}
            >
                {backgroundCloud && (
                    <Image 
                        source={{ uri: optimizedBackground || backgroundCloud }}
                        style={{ 
                            position: 'absolute', 
                            top: 0, 
                            left: 0,
                            width: screenWidth, 
                            aspectRatio: 3/4,
                            zIndex: 0 
                        }}
                        resizeMode="cover"
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
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    cardContainer: { flex: 1, justifyContent: 'flex-start' }, 
    cardInfo: {
        flex: 1, 
        backgroundColor: '#FFFFFF', 
        marginTop: -40, 
        paddingHorizontal: 20, 
        paddingTop: 20,
        shadowColor: "#000", shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5,
    },
    headerInfo: { marginBottom: 10, alignItems: 'center' },
    
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
        color: '#000', 
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
        marginTop: 2
    },
    userName: { 
        fontSize: 13, 
        fontWeight: '500', 
        color: '#888' 
    },

    reactionBar: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        width: '100%',
        paddingHorizontal: 10,
        paddingBottom: 10
    },
    reactionBtn: { 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 8
    },
    reactionText: { 
        fontSize: 12, 
        fontWeight: '600', 
        color: '#999',
        marginTop: 4 
    },
    activeText: {
        color: '#000',
        fontWeight: '800'
    }
});