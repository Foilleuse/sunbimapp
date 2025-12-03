import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image, Pressable } from 'react-native';
import { useEffect, useState, memo } from 'react';
import { Heart, MessageCircle, User, Share2, Eye } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

const FeedCard = memo(({ drawing, canvasSize, index, currentIndex }: { drawing: any, canvasSize: number, index: number, currentIndex: number }) => {
    const [isLiked, setIsLiked] = useState(false);
    const [isHolding, setIsHolding] = useState(false); // Piloté par le bouton Œil
    
    const likesCount = drawing.likes_count || 0;
    const commentsCount = drawing.comments_count || 0;
    const author = drawing.users;

    const isActive = index === currentIndex; 
    
    const shouldRenderDrawing = isActive;

    return (
        <View style={styles.cardContainer}>
            
            {/* ZONE IMAGE NETTE (3:4) + DESSIN */}
            {/* C'est ici qu'on voit le nuage net */}
            <View style={{ width: canvasSize, aspectRatio: 3/4, backgroundColor: '#000', overflow: 'hidden' }}>
                
                {/* 1. IMAGE NETTE DE FOND DE CARTE */}
                <Image 
                    source={{ uri: drawing.cloud_image_url }} 
                    style={StyleSheet.absoluteFill} 
                    resizeMode="cover" 
                />

                {/* 2. DESSIN PAR DESSUS (Fond transparent) */}
                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                    {shouldRenderDrawing && (
                        <DrawingViewer
                            key={`${drawing.id}-${isActive}`} 
                            imageUri={drawing.cloud_image_url}
                            canvasData={drawing.canvas_data}
                            viewerSize={canvasSize}
                            transparentMode={true} // Transparent pour voir l'image nette <Image> dessous
                            animated={isActive} 
                            startVisible={false} 
                        />
                    )}
                </View>
            </View>
            
            <View style={styles.cardInfo}>
                {/* HEADER INFO : Titre + Bouton Œil sur la même ligne */}
                <View style={styles.headerInfo}>
                    
                    {/* LIGNE TITRE ET ŒIL */}
                    <View style={styles.titleRow}>
                        <Text style={styles.drawingTitle} numberOfLines={1}>
                            {drawing.label || "Sans titre"}
                        </Text>

                        {/* BOUTON ŒIL DÉPLACÉ ICI (Aligné à droite) */}
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

                {/* BARRE D'ACTIONS (Bas) */}
                <View style={styles.actionBar}>
                    <View style={styles.leftActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => setIsLiked(!isLiked)}>
                            <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={28} />
                            <Text style={styles.actionText}>{likesCount + (isLiked ? 1 : 0)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
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
        </View>
    );
}, (prev, next) => {
    return prev.drawing.id === next.drawing.id && 
           prev.index === next.index && 
           prev.currentIndex === next.currentIndex;
});

export default function FeedPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
    
    // Image de fond (La première dispo) pour l'ambiance
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            
            {/* --- FOND D'ÉCRAN GLOBAL (AMBIANCE FLOUE) --- */}
            {/* Placé tout au fond, couvre tout l'écran */}
            {backgroundUrl && (
                <Image 
                    source={{uri: backgroundUrl}} 
                    style={[
                        StyleSheet.absoluteFill, 
                        { width: screenWidth, height: screenHeight, zIndex: -1 }
                    ]} 
                    resizeMode="cover"
                    blurRadius={50} // Flou fort
                />
            )}

            <SunbimHeader showCloseButton={false} />
            
            <View style={{ flex: 1 }}>
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
    // Fond noir par défaut (visible si l'image de fond ne charge pas)
    container: { flex: 1, backgroundColor: '#000' }, 
    
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#FFF', fontSize: 16 },
    
    cardContainer: { flex: 1 },
    cardInfo: {
        flex: 1, 
        backgroundColor: '#FFFFFF', 
        marginTop: -40, 
        paddingHorizontal: 20, 
        paddingTop: 25,
        shadowColor: "#000", shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5,
    },
    headerInfo: { marginBottom: 15 },
    
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', 
        marginBottom: 8
    },
    drawingTitle: { 
        fontSize: 28, 
        fontWeight: '900', 
        color: '#000', 
        letterSpacing: -0.5, 
        flex: 1, 
        marginRight: 10 
    },
    eyeBtn: {
        padding: 5,
        marginRight: -5 
    },

    userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateText: { fontSize: 14, color: '#999' },
    
    actionBar: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginTop: 5 
    },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { padding: 5 },
    iconBtnActive: { opacity: 0.3 },
    actionText: { fontSize: 16, fontWeight: '600', color: '#000' },
});