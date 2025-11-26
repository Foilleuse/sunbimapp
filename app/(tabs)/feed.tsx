import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Heart, MessageCircle, User, Share2 } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

// --- SOUS-COMPOSANT : UNE CARTE DU FEED (Dessin + Infos) ---
// Cela permet de gérer l'état "Like" pour chaque carte individuellement
const FeedCard = ({ drawing, canvasSize, isActive }: { drawing: any, canvasSize: number, isActive: boolean }) => {
    const [isLiked, setIsLiked] = useState(false);

    return (
        <View style={styles.cardContainer}>
            
            {/* PARTIE HAUTE : LE DESSIN (Transparent) */}
            <View style={{ width: canvasSize, height: canvasSize }}>
                <DrawingViewer
                    imageUri={drawing.cloud_image_url}
                    canvasData={drawing.canvas_data}
                    viewerSize={canvasSize}
                    transparentMode={true} // Juste les traits
                    animated={isActive}
                    startVisible={false} 
                />
            </View>

            {/* PARTIE BASSE : LES INFOS (Qui swipent avec le dessin) */}
            <View style={styles.cardInfo}>
                
                {/* Titre & Auteur */}
                <View style={styles.headerInfo}>
                    <Text style={styles.drawingTitle}>
                        {drawing.label || "Sans titre"}
                    </Text>
                    <View style={styles.userInfo}>
                         <View style={styles.avatar}><User size={14} color="#666"/></View>
                         <Text style={styles.userName}>Anonyme</Text>
                         <Text style={styles.dateText}>• {new Date(drawing.created_at).toLocaleDateString()}</Text>
                    </View>
                </View>

                {/* Barre d'Actions */}
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setIsLiked(!isLiked)}>
                        <Heart 
                            color={isLiked ? "#FF3B30" : "#000"} 
                            fill={isLiked ? "#FF3B30" : "transparent"} 
                            size={28} 
                        />
                        <Text style={styles.actionText}>{drawing.likes_count || 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn}>
                        <MessageCircle color="#000" size={28} />
                        <Text style={styles.actionText}>{drawing.comments_count || 0}</Text>
                    </TouchableOpacity>

                    {/* Espace flexible pour pousser le share à droite */}
                    <View style={{flex: 1}} /> 

                    <TouchableOpacity>
                        <Share2 color="#000" size={24} />
                    </TouchableOpacity>
                </View>

                {/* Description ou Tag supplémentaire (Optionnel) */}
                <Text style={styles.cloudRef}>
                    Nuage #{drawing.cloud_id?.substring(0, 6)}
                </Text>
            </View>
        </View>
    );
};

// --- PAGE PRINCIPALE ---
export default function FeedPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

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
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#000" size="large" /></View>;
    
    // Image de fond fixe (Le nuage du jour)
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            
            {/* HEADER FIXE */}
            <SunbimHeader showCloseButton={false} />

            {/* CONTENEUR GLOBAL */}
            <View style={{ flex: 1, position: 'relative' }}>
                
                {/* COUCHE 0 : FOND FIXE (Juste l'image, immobile) */}
                {backgroundUrl && (
                    <View style={{ position: 'absolute', top: 0, width: canvasSize, height: canvasSize, zIndex: -1 }}>
                        <DrawingViewer
                            imageUri={backgroundUrl}
                            canvasData={[]} 
                            viewerSize={canvasSize}
                            transparentMode={false} 
                        />
                    </View>
                )}

                {/* COUCHE 1 : SWIPE (Dessins + Infos) */}
                {drawings.length > 0 ? (
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0}
                        orientation="horizontal"
                        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
                    >
                        {drawings.map((drawing, index) => (
                            <View key={drawing.id || index} style={{ flex: 1 }}>
                                <FeedCard 
                                    drawing={drawing} 
                                    canvasSize={canvasSize} 
                                    isActive={index === currentIndex} 
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

    // --- STYLE DE LA CARTE ---
    cardContainer: {
        flex: 1,
        // Pas de background ici pour laisser voir le nuage derrière la partie haute
    },
    // La partie infos en bas (Fond Blanc opaque pour cacher le bas du nuage si besoin, ou juste propre)
    cardInfo: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -20, // Effet "Carte qui remonte sur l'image"
        paddingHorizontal: 20,
        paddingTop: 25,
        // Ombre pour détacher les infos de l'image
        shadowColor: "#000", shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5
    },
    headerInfo: {
        marginBottom: 20,
    },
    drawingTitle: {
        fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5, marginBottom: 8
    },
    userInfo: {
        flexDirection: 'row', alignItems: 'center', gap: 8
    },
    avatar: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center'
    },
    userName: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateText: { fontSize: 14, color: '#999' },

    // Actions
    actionBar: {
        flexDirection: 'row', alignItems: 'center', gap: 25, marginBottom: 20
    },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8
    },
    actionText: {
        fontSize: 16, fontWeight: '600', color: '#000'
    },
    cloudRef: {
        fontSize: 12, color: '#CCC', marginTop: 'auto', marginBottom: 20 // Tout en bas
    }
});