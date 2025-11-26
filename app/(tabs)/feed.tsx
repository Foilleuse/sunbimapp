import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';

// Import dynamique PagerView
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
    
    // On récupère l'image de fond depuis le premier dessin (ils partagent le même nuage)
    // S'il n'y a pas de dessin, pas d'image de fond.
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;
    const activeDrawing = drawings[currentIndex];

    return (
        <View style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
            </View>

            {/* ZONE PRINCIPALE (Superposition) */}
            <View style={{ width: canvasSize, height: canvasSize, backgroundColor: '#F0F0F0', position: 'relative' }}>
                
                {/* COUCHE 1 : FOND FIXE (Statique) */}
                {/* On affiche le viewer avec l'image, mais AUCUNE donnée de dessin */}
                {backgroundUrl && (
                    <View style={StyleSheet.absoluteFill}>
                        <DrawingViewer
                            imageUri={backgroundUrl}
                            canvasData={[]} // Vide ! Juste pour l'image
                            viewerSize={canvasSize}
                            transparentMode={false} // Affiche l'image
                        />
                    </View>
                )}

                {/* COUCHE 2 : SWIPE DES DESSINS (Par dessus) */}
                {/* PagerView est transparent et glisse au dessus du fond */}
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
                                    imageUri={drawing.cloud_image_url} // Nécessaire pour calculer l'échelle
                                    canvasData={drawing.canvas_data}   // Les traits
                                    viewerSize={canvasSize}
                                    transparentMode={true} // <--- MAGIE : N'affiche QUE les traits, pas l'image
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
                    Dessin #{currentIndex + 1} sur {drawings.length}
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