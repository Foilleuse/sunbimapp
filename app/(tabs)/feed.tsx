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

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

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
        if (!drawing.reactions) return;

        // Calculer les totaux à partir des données brutes (si jointes) ou initialiser à 0
        // Pour simplifier ici, on suppose que 'drawing' contient déjà les counts ou on les fetchera
        // Dans une implémentation réelle optimisée, on utiliserait une vue SQL ou une fonction RPC.
        // Ici, on va faire une requête pour charger l'état initial si nécessaire.
        fetchReactionsState();
    }, [drawing.id]);

    const fetchReactionsState = async () => {
        try {
            // 1. Récupérer toutes les réactions pour ce dessin pour compter
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
                if (user && r.user_id === user.id) {
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
        if (!user || !type) return;

        // Optimistic UI Update
        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };

        // Si on clique sur la même réaction, on l'enlève (toggle off)
        if (userReaction === type) {
            setUserReaction(null);
            setReactionCounts(prev => ({
                ...prev,
                [type]: Math.max(0, prev[type] - 1)
            }));
            
            try {
                await supabase.from('reactions').delete().eq('user_id', user.id).eq('drawing_id', drawing.id);
            } catch (e) {
                // Rollback
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        } 
        // Si on change de réaction ou qu'on en ajoute une nouvelle
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
                // Upsert permet de gérer l'insert ou l'update en une seule requête grâce à la contrainte unique (user_id, drawing_id)
                const { error } = await supabase
                    .from('reactions')
                    .upsert({
                        user_id: user.id,
                        drawing_id: drawing.id,
                        reaction_type: type
                    }, { onConflict: 'user_id, drawing_id' });
                
                if (error) throw error;
            } catch (e) {
                console.error(e);
                // Rollback
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
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
                        
                        <TouchableOpacity onPress={handleReport} style={styles.moreBtn} hitSlop={15}>
                            <MoreHorizontal color="#999" size={24} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.userInfo} 
                        onPress={() => onUserPress(author)} 
                        activeOpacity={0.7}
                    >
                         <View style={styles.avatar}>
                            {author?.avatar_url ? (
                                <Image source={{uri: optimizedAvatar || author.avatar_url}} style={{width:24, height:24, borderRadius:12}} />
                            ) : (
                                <User size={14} color="#666"/>
                            )}
                         </View>
                         <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>
                         <Text style={styles.dateText}>• {new Date(drawing.created_at).toLocaleDateString()}</Text>
                    </TouchableOpacity>
                </View>

                {/* --- BARRE DE RÉACTIONS --- */}
                <View style={styles.reactionBar}>
                    
                    <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('like')}>
                        <Heart 
                            color={userReaction === 'like' ? "#FF3B30" : "#000"} 
                            fill={userReaction === 'like' ? "#FF3B30" : "transparent"} 
                            size={24} 
                        />
                        <Text style={[styles.reactionText, userReaction === 'like' && styles.activeText]}>
                            {reactionCounts.like || 0}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('smart')}>
                        <Lightbulb 
                            color={userReaction === 'smart' ? "#FFCC00" : "#000"} 
                            fill={userReaction === 'smart' ? "#FFCC00" : "transparent"} 
                            size={24} 
                        />
                        <Text style={[styles.reactionText, userReaction === 'smart' && styles.activeText]}>
                            {reactionCounts.smart || 0}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('beautiful')}>
                        <Palette 
                            color={userReaction === 'beautiful' ? "#5856D6" : "#000"} 
                            fill={userReaction === 'beautiful' ? "#5856D6" : "transparent"} 
                            size={24} 
                        />
                        <Text style={[styles.reactionText, userReaction === 'beautiful' && styles.activeText]}>
                            {reactionCounts.beautiful || 0}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('crazy')}>
                        {/* Pour "Dingue", on utilise une icône Zap (éclair) ou une autre icône disponible dans Lucide car "tête qui explose" n'y est pas en standard vectoriel, ou on pourrait utiliser un emoji Text */}
                        <Zap 
                            color={userReaction === 'crazy' ? "#FF2D55" : "#000"} 
                            fill={userReaction === 'crazy' ? "#FF2D55" : "transparent"} 
                            size={24} 
                        />
                        <Text style={[styles.reactionText, userReaction === 'crazy' && styles.activeText]}>
                            {reactionCounts.crazy || 0}
                        </Text>
                    </TouchableOpacity>

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
    
    const [isGlobalHolding, setIsGlobalHolding] = useState(false);
    
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

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
        paddingTop: 25,
        shadowColor: "#000", shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5,
    },
    headerInfo: { marginBottom: 15 },
    
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    drawingTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5, flex: 1, marginRight: 10 },
    
    moreBtn: { padding: 5, marginTop: 5 }, 
    
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
    
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateText: { fontSize: 14, color: '#999' },

    // Nouvelle barre de réactions
    reactionBar: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 5,
        paddingHorizontal: 10
    },
    reactionBtn: { 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 5
    },
    reactionText: { 
        fontSize: 12, 
        fontWeight: '600', 
        color: '#666',
        marginTop: 4 
    },
    activeText: {
        color: '#000',
        fontWeight: '700'
    }
});