import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable } from 'react-native';
import { useEffect, useState, memo } from 'react';
import { Heart, MessageCircle, User, Share2, Eye } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useAuth } from '../../src/contexts/AuthContext';
import { CommentsModal } from '../../src/components/CommentsModal';
import { UserProfileModal } from '../../src/components/UserProfileModal'; 
import { useRouter } from 'expo-router';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer'; 

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

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

    const optimizedAvatarUrl = getOptimizedImageUrl(author?.avatar_url, 50);

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

    return (
        <View style={styles.cardContainer}>
            
            {/* ZONE DE DESSIN (Transparente pour laisser voir le fond flou) */}
            <View style={{ width: canvasSize, aspectRatio: 3/4, backgroundColor: 'transparent' }}>
                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                    {shouldRenderDrawing && (
                        <DrawingViewer
                            key={`${drawing.id}-${isActive}`} 
                            imageUri={drawing.cloud_image_url} 
                            canvasData={drawing.canvas_data}
                            viewerSize={canvasSize}
                            transparentMode={true} // IMPORTANT: Le viewer ne dessine pas l'image, on voit le fond flou
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
                            style={[styles.eyeBtn, isHolding && styles.iconBtnActive]}
                            activeOpacity={1}
                            onPressIn={() => setIsHolding(true)}
                            onPressOut={() => setIsHolding(false)}
                            hitSlop={15}
                        >
                            <Eye color={isHolding ? "#000" : "#000"} size={26} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.userInfo} 
                        onPress={() => onUserPress(author)} 
                        activeOpacity={0.7}
                    >
                         <View style={styles.avatar}>
                            {optimizedAvatarUrl ? (
                                <Image source={{uri: optimizedAvatarUrl}} style={{width:24, height:24, borderRadius:12}} />
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
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window'); // Besoin de la hauteur aussi

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

    useEffect(() => { fetchTodaysFeed(); }, []);

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (cloudData) {
                const optimizedBg = getOptimizedImageUrl(cloudData.image_url, screenWidth, 90);
                setBackgroundCloud(optimizedBg || cloudData.image_url);

                const { data: drawingsData, error: drawingsError } = await supabase
                    .from('drawings')
                    .select('*, users(id, display_name, avatar_url), likes(count), comments(count)') 
                    .eq('cloud_id', cloudData.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

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

    return (
        <View style={styles.container}>
            <SunbimHeader showCloseButton={false} />
            
            {/* BACKGROUND IMAGE FLOU PLEIN ÉCRAN */}
            {backgroundCloud && (
                <View style={StyleSheet.absoluteFill}>
                    <Image 
                        source={{ uri: backgroundCloud }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        blurRadius={30} // Effet de flou gaussien natif (iOS/Android)
                    />
                    {/* Overlay semi-transparent pour améliorer la lisibilité si besoin */}
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                </View>
            )}
            
            <View style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                {drawings.length > 0 ? (
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0} 
                        onPageSelected={(e: any) => setCurrentIndex(e.nativeEvent.position)}
                        offscreenPageLimit={1} 
                    >
                        {drawings.map((drawing, index) => (
                            <View key={drawing.id} style={{ flex: 1 }}>
                                <FeedCard 
                                    drawing={drawing} 
                                    canvasSize={screenWidth} 
                                    index={index}
                                    currentIndex={currentIndex}
                                    onUserPress={handleUserPress}
                                />
                            </View>
                        ))}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
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
    container: { flex: 1, backgroundColor: '#FFFFFF' }, // Le background blanc est couvert par l'image absolue
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    cardContainer: { flex: 1 },
    cardInfo: {
        flex: 1, 
        backgroundColor: '#FFFFFF', 
        marginTop: -40, 
        paddingHorizontal: 20, 
        paddingTop: 25,
        shadowColor: "#000", shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5,
        borderTopLeftRadius: 20, // Ajout d'arrondi pour le style "carte" par dessus le fond
        borderTopRightRadius: 20
    },
    headerInfo: { marginBottom: 15 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    drawingTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5, flex: 1, marginRight: 10 },
    eyeBtn: { padding: 5, marginRight: -5 },
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