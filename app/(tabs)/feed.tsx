import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Heart, MessageCircle, User } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import Carousel from 'react-native-reanimated-carousel';

export default function FeedPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLiked, setIsLiked] = useState(false);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

    useEffect(() => {
        fetchTodaysFeed();
    }, []);

    useEffect(() => { setIsLiked(false); }, [currentIndex]);

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
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleLike = () => setIsLiked(!isLiked);
    const handleComment = () => console.log("Commentaire...");

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#87CEEB" size="large" /></View>;
    
    const activeDrawing = drawings[currentIndex];
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            
            <SunbimHeader showCloseButton={false} />

            <View style={{ width: canvasSize, height: canvasSize, backgroundColor: '#F0F0F0', position: 'relative' }}>
                
                {backgroundUrl && (
                    <View style={StyleSheet.absoluteFill}>
                        <DrawingViewer
                            imageUri={backgroundUrl}
                            canvasData={[]} 
                            viewerSize={canvasSize}
                            transparentMode={false} 
                            animated={false}
                        />
                    </View>
                )}

                {drawings.length > 0 ? (
                    <Carousel
                        loop={false}
                        width={canvasSize}
                        height={canvasSize}
                        data={drawings}
                        scrollAnimationDuration={600} // Plus rapide aussi au swipe
                        onSnapToItem={(index) => setCurrentIndex(index)}
                        // --- REGLAGES FUN ---
                        mode="parallax"
                        modeConfig={{
                            parallaxScrollingScale: 0.8, // Effet de profondeur marqué
                            parallaxScrollingOffset: 130, // Chevauchement important
                        }}
                        renderItem={({ item, index }) => {
                            const isActive = index === currentIndex;
                            return (
                                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                                    <DrawingViewer
                                        imageUri={item.cloud_image_url}
                                        canvasData={item.canvas_data}
                                        viewerSize={canvasSize}
                                        transparentMode={true}
                                        animated={isActive} 
                                        startVisible={false} 
                                    />
                                </View>
                            );
                        }}
                    />
                ) : (
                    <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
                )}
            </View>

            <View style={styles.socialContainer}>
                 <View style={styles.titleRow}>
                    <Text style={styles.drawingTitle}>
                        {activeDrawing?.label || "Sans titre"}
                    </Text>
                 </View>
                 <View style={styles.metaRow}>
                    <View style={styles.userProfile}>
                        <View style={styles.avatarPlaceholder}><User size={16} color="#666" /></View>
                        <Text style={styles.userName}>Anonyme</Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                            <Heart color={isLiked ? "#FF3B30" : "#000"} fill={isLiked ? "#FF3B30" : "transparent"} size={26} />
                            <Text style={styles.statText}>{activeDrawing?.likes_count || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleComment}>
                            <MessageCircle color="#000" size={26} />
                            <Text style={styles.statText}>{activeDrawing?.comments_count || 0}</Text>
                        </TouchableOpacity>
                    </View>
                 </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    socialContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20, backgroundColor: '#FFF' },
    titleRow: { marginBottom: 15 },
    drawingTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    userProfile: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statText: { fontSize: 14, fontWeight: '600', color: '#000' },
});