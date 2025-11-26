import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader'; // Import Header

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

export default function FeedPage() {
    const router = useRouter();
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

    useEffect(() => { fetchTodaysFeed(); }, []);

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (cloudData) {
                const { data: drawingsData } = await supabase.from('drawings').select('*').eq('cloud_id', cloudData.id).order('created_at', { ascending: false }).limit(50);
                setDrawings(drawingsData || []);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#87CEEB" size="large" /></View>;
    
    const activeDrawing = drawings[currentIndex];
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            
            {/* HEADER UNIQUE */}
            <SunbimHeader showCloseButton={true} /> 
            {/* showCloseButton=true ici car on vient de l'accueil et on veut pouvoir repartir si besoin */}

            {/* CONTENU */}
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
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0}
                        orientation="horizontal"
                        onPageSelected={(e: any) => setCurrentIndex(e.nativeEvent.position)}
                    >
                        {drawings.map((drawing, index) => (
                            <View key={drawing.id || index} style={{ flex: 1, backgroundColor: 'transparent' }}>
                                <DrawingViewer
                                    imageUri={drawing.cloud_image_url}
                                    canvasData={drawing.canvas_data}
                                    viewerSize={canvasSize}
                                    transparentMode={true}
                                    animated={index === currentIndex} 
                                    startVisible={false} 
                                />
                            </View>
                        ))}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
                )}
            </View>

            <View style={styles.interactions}>
                 <Text style={styles.drawingTitle}>
                    {activeDrawing ? (activeDrawing.label || "Sans titre") : ''}
                 </Text>
                 <Text style={styles.userText}>
                    {drawings.length > 0 ? `Dessin ${currentIndex + 1} sur ${drawings.length}` : ''}
                 </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    interactions: { width: '100%', padding: 20, alignItems: 'flex-start' },
    drawingTitle: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 4 },
    userText: { color: '#888', fontSize: 14 },
});