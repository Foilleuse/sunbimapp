import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Animated } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Heart, MessageCircle, User, Share2 } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

const FeedCard = ({ drawing, canvasSize, isActive, forceStatic }: { drawing: any, canvasSize: number, isActive: boolean, forceStatic: boolean }) => {
    const [isLiked, setIsLiked] = useState(false);

    // LOGIQUE CORRIGÉE :
    // 1. On anime seulement si c'est la carte active ET qu'on ne force pas le statique
    const shouldAnimate = isActive && !forceStatic;
    
    // 2. Visibilité au démarrage :
    // - Si c'est "forceStatic" (mon dessin juste posté) -> Visible tout de suite (True)
    // - Pour TOUS les autres (le feed normal) -> Invisible au début (False), l'animation le fera apparaître
    const startVisible = forceStatic; 

    return (
        <View style={styles.cardContainer}>
            <View style={{ width: canvasSize, height: canvasSize }}>
                <DrawingViewer
                    imageUri={drawing.cloud_image_url}
                    canvasData={drawing.canvas_data}
                    viewerSize={canvasSize}
                    transparentMode={true} 
                    animated={shouldAnimate}
                    startVisible={startVisible} // <--- C'EST ICI LA CORRECTION
                />
            </View>
            <View style={styles.cardInfo}>
                <View style={styles.headerInfo}>
                    <Text style={styles.drawingTitle}>{drawing.label || "Sans titre"}</Text>
                    <View style={styles.userInfo}>
                         <View style={styles.avatar}><User size={14} color="#666"/></View>
                         <Text style={styles.userName}>Anonyme</Text>
                         <Text style={styles.dateText}>• {new Date(drawing.created_at).toLocaleDateString()}</Text>
                    </View>
                </View>
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setIsLiked(!isLiked)}>
                        <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={28} />
                        <Text style={styles.actionText}>{drawing.likes_count || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                        <MessageCircle color="#000" size={28} />
                        <Text style={styles.actionText}>{drawing.comments_count || 0}</Text>
                    </TouchableOpacity>
                    <View style={{flex: 1}} /> 
                    <TouchableOpacity><Share2 color="#000" size={24} /></TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default function FeedPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const justPosted = params.justPosted === 'true';

    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        fetchTodaysFeed();
    }, []);

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (cloudData) {
                const { data: drawingsData } = await supabase
                    .from('drawings')
                    .select('*')
                    .eq('cloud_id', cloudData.id)
                    .order('created_at', { ascending: false })
                    .limit(50); 
                setDrawings(drawingsData || []);
            }
        } catch (e) { console.error(e); } finally { 
            setLoading(false);
            Animated.timing(fadeAnim, {
                toValue: 0, 
                duration: 800,
                useNativeDriver: true,
            }).start();
        }
    };

    const activeDrawing = drawings[currentIndex];
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            
            <Animated.View 
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill, 
                    { backgroundColor: 'white', opacity: fadeAnim, zIndex: 9999 }
                ]} 
            />

            <SunbimHeader showCloseButton={false} />

            <View style={{ flex: 1, position: 'relative' }}>
                
                {/* FOND FIXE */}
                <View style={{ position: 'absolute', top: 0, width: canvasSize, height: canvasSize, zIndex: -1, backgroundColor: '#F0F0F0' }}>
                    {backgroundUrl && (
                        <DrawingViewer
                            imageUri={backgroundUrl}
                            canvasData={[]} 
                            viewerSize={canvasSize}
                            transparentMode={false} 
                            animated={false}
                        />
                    )}
                </View>

                {/* SWIPE */}
                {!loading && drawings.length > 0 ? (
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0}
                        orientation="horizontal"
                        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
                    >
                        {drawings.map((drawing, index) => {
                            const isActive = index === currentIndex;
                            const isMyNewDrawing = justPosted && index === 0;

                            return (
                                <View key={drawing.id || index} style={{ flex: 1 }}>
                                    <FeedCard 
                                        drawing={drawing} 
                                        canvasSize={canvasSize} 
                                        isActive={isActive}
                                        forceStatic={isMyNewDrawing}
                                    />
                                </View>
                            );
                        })}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}>
                        {!loading && <Text style={styles.text}>La galerie est vide.</Text>}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    // loadingContainer supprimé
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
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateText: { fontSize: 14, color: '#999' },
    actionBar: { flexDirection: 'row', alignItems: 'center', gap: 25 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionText: { fontSize: 16, fontWeight: '600', color: '#000' },
});