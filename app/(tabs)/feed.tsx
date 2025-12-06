import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable, Alert } from 'react-native';
import { useEffect, useState, memo } from 'react';
import { Heart, MessageCircle, User, Share2, Eye, MoreHorizontal } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { CommentsModal } from '../../src/components/CommentsModal'; 
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { useRouter } from 'expo-router'; 
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
import Carousel from 'react-native-reanimated-carousel';

const FeedCard = memo(({ drawing, canvasSize, index, currentIndex, onUserPress }: { drawing: any, canvasSize: number, index: number, currentIndex: number, onUserPress: (user: any) => void }) => {
    const { user } = useAuth();
    
    const initialLikesCount = drawing.likes?.[0]?.count || 0;

    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(initialLikesCount);
    const [showComments, setShowComments] = useState(false); 
    
    const [isHolding, setIsHolding] = useState(false); 
    
    const commentsCount = drawing.comments?.[0]?.count || 0;
    
    const author = drawing.users;
    const isActive = index === currentIndex; 
    const shouldRenderDrawing = isActive;

    useEffect(() => {
        setLikesCount(drawing.likes?.[0]?.count || 0);
    }, [drawing]);

    useEffect(() => {
        if (!user) return;
        const checkLikeStatus = async () => {
            const { count } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('drawing_id', drawing.id);
            
            if (count && count > 0) setIsLiked(true);
            else setIsLiked(false);
        };
        checkLikeStatus();
    }, [user, drawing.id]);

    const handleLike = async () => {
        if (!user) return;

        const previousLiked = isLiked;
        const previousCount = likesCount;

        const newLikedState = !previousLiked;
        const newCount = newLikedState ? previousCount + 1 : Math.max(0, previousCount - 1);

        setIsLiked(newLikedState);
        setLikesCount(newCount);

        try {
            if (previousLiked) {
                const { error } = await supabase
                    .from('likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('drawing_id', drawing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('likes')
                    .insert({
                        user_id: user.id,
                        drawing_id: drawing.id
                    });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Erreur like:", error);
            setIsLiked(previousLiked);
            setLikesCount(previousCount);
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

                {/* Bouton Oeil déplacé SUR la photo (Coin bas droit), style statique */}
                <TouchableOpacity 
                    style={styles.eyeOverlay}
                    activeOpacity={1}
                    onPressIn={() => setIsHolding(true)}
                    onPressOut={() => setIsHolding(false)}
                >
                    <Eye color="#000" size={28} />
                </TouchableOpacity>
            </View>
            
            <View style={styles.cardInfo}>
                <View style={styles.headerInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.drawingTitle} numberOfLines={1}>
                            {drawing.label || "Sans titre"}
                        </Text>
                        
                        {/* Bouton Options "..." aligné avec le titre */}
                        <TouchableOpacity 
                            onPress={handleReport} 
                            style={styles.moreBtn}
                            hitSlop={15}
                        >
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

                <View style={styles.actionBar}>
                    <View style={styles.leftActions}>
                        
                        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                            <Heart 
                                color={isLiked ? "#FF3B30" : "#000"} 
                                fill={isLiked ? "#FF3B30" : "transparent"} 
                                size={28} 
                            />
                            <Text style={styles.actionText}>{likesCount}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
                            <MessageCircle color="#000" size={28} />
                            <Text style={styles.actionText}>{commentsCount}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.rightActions}>
                        <TouchableOpacity style={styles.iconBtn}>
                            <Share2 color="#000" size={24} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <CommentsModal 
                visible={showComments} 
                onClose={() => setShowComments(false)} 
                drawingId={drawing.id} 
            />
        </View>
    );
}, (prev, next) => {
    return prev.drawing.id === next.drawing.id && 
           prev.index === next.index && 
           prev.currentIndex === next.currentIndex;
});

export default function FeedPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);
    const { width: screenWidth } = Dimensions.get('window');
    
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

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
                    .select('*, users(id, display_name, avatar_url), likes(count), comments(count)') 
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
                            />
                        )}
                    />
                ) : (
                    !loading && drawings.length === 0 ? (
                        <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
                    ) : null
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
    
    // MODIFICATION ICI : Style statique (sans fond)
    eyeOverlay: {
        position: 'absolute',
        bottom: 55, // Positionné au-dessus de la carte blanche
        right: 20,
        // Pas de background, pas d'ombre, pas de bordure = "Statique" visuellement
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50, // Priorité haute pour le clic
    },
    
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateText: { fontSize: 14, color: '#999' },
    actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { padding: 5 },
    iconBtnActive: { opacity: 0.3 },
    actionText: { fontSize: 16, fontWeight: '600', color: '#000' },
});