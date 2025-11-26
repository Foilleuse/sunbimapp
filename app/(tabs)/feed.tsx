import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingViewer } from '../src/components/DrawingViewer';

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
    const [currentCloud, setCurrentCloud] = useState<any>(null);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

    useEffect(() => {
        fetchTodaysFeed();
    }, []);

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // 1. On récupère le nuage du jour pour avoir son ID
            const { data: cloudData, error: cloudError } = await supabase
                .from('clouds')
                .select('*')
                .eq('published_for', today)
                .maybeSingle();

            if (cloudError) throw cloudError;
            setCurrentCloud(cloudData);

            if (cloudData) {
                // 2. On récupère UNIQUEMENT les dessins liés à CE nuage
                const { data: drawingsData, error: drawingsError } = await supabase
                    .from('drawings')
                    .select('*')
                    .eq('cloud_id', cloudData.id) // <--- LE FILTRE IMPORTANT
                    .order('created_at', { ascending: false })
                    .limit(50); 

                if (drawingsError) throw drawingsError;
                setDrawings(drawingsData || []);
            }
            
        } catch (e) {
            console.error("Erreur feed:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#87CEEB" size="large" /></View>;
    
    const activeDrawing = drawings[currentIndex];
    
    // L'image de fond est celle du nuage du jour
    const backgroundUrl = currentCloud?.image_url;

    return (
        <View style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
                    <X color="#000" size={28} /> 
                </TouchableOpacity>
            </View>

            {/* ZONE CONTENU */}
            <View style={{ width: canvasSize, height: canvasSize, backgroundColor: '#F0F0F0', position: 'relative' }}>
                
                {/* COUCHE 1 : FOND FIXE (Le Nuage du Jour) */}
                {backgroundUrl && (
                    <View style={StyleSheet.absoluteFill}>
                        <DrawingViewer
                            imageUri={backgroundUrl}
                            canvasData={[]} // Rien à dessiner sur le fond
                            viewerSize={canvasSize}
                            transparentMode={false} 
                        />
                    </View>
                )}

                {/* COUCHE 2 : SWIPE DES DESSINS */}
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
                                    imageUri={backgroundUrl} // On passe la même image pour caler l'échelle
                                    canvasData={drawing.canvas_data} // <--- LES DONNÉES DU DESSIN
                                    viewerSize={canvasSize}
                                    transparentMode={true} // Juste les traits
                                />
                            </View>
                        ))}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}><Text style={styles.text}>Sois le premier à dessiner !</Text></View>
                )}
            </View>

            {/* INFOS */}
            <View style={styles.interactions}>
                 <Text style={styles.drawingTitle}>
                    {currentCloud?.title || "Nuage du jour"}
                 </Text>
                 <Text style={styles.userText}>
                    {drawings.length > 0 
                        ? `Dessin ${currentIndex + 1} sur ${drawings.length}`
                        : "Aucun dessin pour l'instant"
                    }
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
    closeBtn: { position: 'absolute', right: 20, bottom: 15 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { color: '#666', fontSize: 16 },
    interactions: { width: '100%', padding: 20, alignItems: 'flex-start' },
    drawingTitle: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 4 },
    userText: { color: '#888', fontSize: 14 },
});