import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
// CORRECTION DES IMPORTS (../../)
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import PagerView from 'react-native-pager-view';

export default function FeedPage() {
    const router = useRouter();
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

    useEffect(() => {
        fetchDrawings();
    }, []);

    const fetchDrawings = async () => {
        try {
            const { data, error } = await supabase
                .from('drawings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20); 

            if (error) throw error;
            setDrawings(data || []);
        } catch (e) {
            console.error("Erreur feed:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#87CEEB" size="large" /></View>;
    
    const activeDrawing = drawings[currentIndex];

    return (
        <View style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
                {/* Le bouton X ne sert plus trop ici car on navigue par tabs, mais on peut le garder ou l'enlever */}
            </View>

            {/* SWIPE */}
            <View style={{ width: canvasSize, height: canvasSize, backgroundColor: '#F0F0F0' }}>
                {drawings.length > 0 ? (
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0}
                        orientation="horizontal"
                        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
                    >
                        {drawings.map((drawing, index) => (
                            <View key={drawing.id || index} style={{ flex: 1 }}>
                                <DrawingViewer
                                    imageUri={drawing.cloud_image_url}
                                    canvasData={drawing.canvas_data}
                                    viewerSize={canvasSize}
                                />
                            </View>
                        ))}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}>
                        <Text style={styles.text}>La galerie est vide.</Text>
                    </View>
                )}
            </View>

            {/* INFOS */}
            <View style={styles.interactions}>
                 <Text style={styles.drawingTitle}>
                    {activeDrawing ? `Nuage du ${new Date(activeDrawing.created_at).toLocaleDateString()}` : ''}
                 </Text>
                 <Text style={styles.userText}>
                    Dessin #{currentIndex + 1}
                 </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    headerBar: {
        width: '100%', backgroundColor: '#FFFFFF', 
        paddingTop: 60, paddingBottom: 15, paddingHorizontal: 20,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', zIndex: 10,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0'
    },
    headerText: {
        fontSize: 32, fontWeight: '900', color: '#FFFFFF', 
        textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0, 
    },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    interactions: { width: '100%', padding: 20, alignItems: 'flex-start' },
    drawingTitle: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 4 },
    userText: { color: '#888', fontSize: 14 },
});