import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image } from 'react-native';
import { useEffect, useState, memo } from 'react';
import { Heart, MessageCircle, User, Share2 } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';

// Import conditionnel PagerView pour le web
let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

// --- COMPOSANT CARTE MÉMOÏSÉ ---
const FeedCard = memo(({ drawing, canvasSize, index, currentIndex }: { drawing: any, canvasSize: number, index: number, currentIndex: number }) => {
    const [isLiked, setIsLiked] = useState(false);
    
    const likesCount = drawing.likes_count || 0;
    const commentsCount = drawing.comments_count || 0;
    const author = drawing.users;

    // --- LOGIQUE DE VISIBILITÉ ---
    const isActive = index === currentIndex; // C'est la carte qu'on regarde
    const isPast = index < currentIndex;     // C'est une carte déjà passée (à gauche)

    return (
        <View style={styles.cardContainer}>
            {/* backgroundColor transparent pour voir le nuage de fond commun */}
            <View style={{ width: canvasSize, height: canvasSize, backgroundColor: 'transparent' }}>
                <DrawingViewer
                    imageUri={drawing.cloud_image_url}
                    canvasData={drawing.canvas_data}
                    viewerSize={canvasSize}
                    transparentMode={true} 
                    
                    // Si c'est la carte active -> On anime.
                    // Si c'est une carte future -> Pas d'anim.
                    animated={isActive} 

                    // Si c'est une carte passée -> On affiche le résultat direct.
                    // Si c'est une carte future -> On n'affiche rien (false).
                    startVisible={isPast} 
                />
            </View>
            <View style={styles.cardInfo}>
                <View style={styles.headerInfo}>
                    <Text style={styles.drawingTitle}>{drawing.label || "Sans titre"}</Text>
                    <View style={styles.userInfo}>
                         <View style={styles.avatar}>
                            {author?.avatar_url ? (
                                <Image source={{uri: author.avatar_url}} style={{width:24, height:24, borderRadius:12}} />
                            ) : (
                                <User size={14} color="#666"/>
                            )}
                         </View>
                         <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>
                         <Text style={styles.dateText}>• {new Date(drawing.created_at).toLocaleDateString()}</Text>
                    </View>
                </View>
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setIsLiked(!isLiked)}>
                        <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={28} />
                        <Text style={styles.actionText}>{likesCount + (isLiked ? 1 : 0)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                        <MessageCircle color="#000" size={28} />
                        <Text style={styles.actionText}>{commentsCount}</Text>
                    </TouchableOpacity>
                    <View style={{flex: 1}} /> 
                    <TouchableOpacity><Share2 color="#000" size={24} /></TouchableOpacity>
                </View>
            </View>
        </View>
    );
}, (prev, next) => {
    // On re-render si l'index actuel change (pour mettre à jour isActive/isPast) ou si le dessin change
    return prev.drawing.id === next.drawing.id && 
           prev.index === next.index && 
           prev.currentIndex === next.currentIndex;
});

export default function FeedPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const { width: screenWidth } = Dimensions.get('window');

    useEffect(() => { fetchTodaysFeed(); }, []);

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (cloudData) {
                const { data: drawingsData, error: drawingsError } = await supabase
                    .from('drawings')
                    .select('*, users(display_name, avatar_url)') 
                    .eq('cloud_id', cloudData.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (drawingsError) throw drawingsError;
                setDrawings(drawingsData || []);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#000" size="large" /></View>;
    
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            <SunbimHeader showCloseButton={false} />
            <View style={{ flex: 1, position: 'relative' }}>
                {/* Image de fond unique pour tout le feed (évite le chargement par carte) */}
                {backgroundUrl && (
                    <View style={{ position: 'absolute', top: 0, width: screenWidth, height: screenWidth, zIndex: -1 }}>
                       <Image source={{uri: backgroundUrl}} style={{width: screenWidth, height: screenWidth}} resizeMode="cover" />
                    </View>
                )}
                
                {drawings.length > 0 ? (
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0} 
                        onPageSelected={(e: any) => setCurrentIndex(e.nativeEvent.position)}
                        offscreenPageLimit={1} // Garde seulement 1 page en mémoire de chaque côté
                    >
                        {drawings.map((drawing, index) => (
                            <View key={drawing.id} style={{ flex: 1 }}>
                                <FeedCard 
                                    drawing={drawing} 
                                    canvasSize={screenWidth} 
                                    index={index}
                                    currentIndex={currentIndex}
                                />
                            </View>
                        ))}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    cardContainer: { flex: 1 },
    cardInfo: {
        flex: 1, backgroundColor: '#FFFFFF', marginTop: -20, paddingHorizontal: 20, paddingTop: 25,
        shadowColor: "#000", shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5
    },
    headerInfo: { marginBottom: 20 },
    drawingTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5, marginBottom: 8 },
    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateText: { fontSize: 14, color: '#999' },
    actionBar: { flexDirection: 'row', alignItems: 'center', gap: 25 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionText: { fontSize: 16, fontWeight: '600', color: '#000' },
});