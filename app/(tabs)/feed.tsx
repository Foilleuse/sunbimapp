import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { X, Heart, MessageCircle, User } from 'lucide-react-native'; // Ajout des icones sociales
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

export default function FeedPage() {
    const router = useRouter();
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    // État local pour simuler le like instantané (UX)
    const [isLiked, setIsLiked] = useState(false);

    const { width: screenWidth } = Dimensions.get('window');
    const canvasSize = screenWidth; 

    useEffect(() => {
        fetchTodaysFeed();
    }, []);

    // Quand on change de slide, on reset l'état "Aimé" (pour la démo)
    // Plus tard, on vérifiera si l'user a vraiment liké ce dessin via Supabase
    useEffect(() => {
        setIsLiked(false);
    }, [currentIndex]);

    const fetchTodaysFeed = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData, error: cloudError } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            if (cloudData) {
                const { data: drawingsData, error: drawingsError } = await supabase
                    .from('drawings')
                    .select('*')
                    .eq('cloud_id', cloudData.id)
                    .order('created_at', { ascending: false })
                    .limit(50); 

                if (drawingsError) throw drawingsError;
                setDrawings(drawingsData || []);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // Action Like
    const handleLike = () => {
        setIsLiked(!isLiked);
        // TODO: Envoyer la requête à Supabase pour incrémenter likes_count
    };

    // Action Commentaire
    const handleComment = () => {
        console.log("Ouvrir commentaires pour le dessin", activeDrawing?.id);
        // TODO: Ouvrir une modale de commentaires
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#87CEEB" size="large" /></View>;
    
    const activeDrawing = drawings[currentIndex];
    const backgroundUrl = drawings.length > 0 ? drawings[0].cloud_image_url : null;

    return (
        <View style={styles.container}>
            
            {/* HEADER */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
            </View>

            {/* ZONE SWIPE (Image + Dessins) */}
            <View style={{ width: canvasSize, height: canvasSize, backgroundColor: '#F0F0F0', position: 'relative' }}>
                
                {/* FOND */}
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

                {/* SWIPE */}
                {drawings.length > 0 ? (
                    <PagerView 
                        style={{ flex: 1 }} 
                        initialPage={0}
                        orientation="horizontal"
                        onPageSelected={(e: any) => setCurrentIndex(e.nativeEvent.position)}
                    >
                        {drawings.map((drawing, index) => {
                            const isActive = index === currentIndex;
                            return (
                                <View key={drawing.id || index} style={{ flex: 1, backgroundColor: 'transparent' }}>
                                    <DrawingViewer
                                        imageUri={drawing.cloud_image_url}
                                        canvasData={drawing.canvas_data}
                                        viewerSize={canvasSize}
                                        transparentMode={true}
                                        animated={isActive} 
                                        startVisible={false} 
                                    />
                                </View>
                            );
                        })}
                    </PagerView>
                ) : (
                    <View style={styles.centerBox}><Text style={styles.text}>La galerie est vide.</Text></View>
                )}
            </View>

            {/* --- NOUVEAU : ZONE D'INFORMATIONS SOCIALES --- */}
            <View style={styles.socialContainer}>
                 
                 {/* 1. Le TAG (Titre) */}
                 <View style={styles.titleRow}>
                    <Text style={styles.drawingTitle}>
                        {activeDrawing?.label || "Sans titre"}
                    </Text>
                 </View>

                 {/* 2. Profil & Actions */}
                 <View style={styles.metaRow}>
                    
                    {/* Profil User */}
                    <View style={styles.userProfile}>
                        <View style={styles.avatarPlaceholder}>
                            <User size={16} color="#666" />
                        </View>
                        <Text style={styles.userName}>Anonyme</Text>
                    </View>

                    {/* Boutons Actions */}
                    <View style={styles.actions}>
                        
                        {/* LIKE */}
                        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                            <Heart 
                                color={isLiked ? "#FF3B30" : "#000"} 
                                fill={isLiked ? "#FF3B30" : "transparent"} 
                                size={26} 
                            />
                            <Text style={styles.statText}>{activeDrawing?.likes_count || 0}</Text>
                        </TouchableOpacity>

                        {/* COMMENTAIRE */}
                        <TouchableOpacity style={styles.actionBtn} onPress={handleComment}>
                            <MessageCircle color="#000" size={26} />
                            <Text style={styles.statText}>{activeDrawing?.comments_count || 0}</Text>
                        </TouchableOpacity>
                    
                    </View>
                 </View>

                 {/* Indicateur de position (optionnel) */}
                 <Text style={styles.paginationText}>
                    {drawings.length > 0 ? `${currentIndex + 1} / ${drawings.length}` : ''}
                 </Text>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    
    // HEADER
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

    // SOCIAL SECTION
    socialContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
        backgroundColor: '#FFF',
    },
    titleRow: {
        marginBottom: 15,
    },
    drawingTitle: {
        fontSize: 28, // Très gros pour le tag
        fontWeight: '900',
        color: '#000',
        letterSpacing: -0.5,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    // Profil
    userProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatarPlaceholder: {
        width: 32, height: 32,
        borderRadius: 16,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center', alignItems: 'center',
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    // Actions
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
    },
    // Pagination
    paginationText: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        color: '#CCC',
        fontSize: 12,
    }
});