import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Heart, MessageCircle, User, Share2 } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { CommentsModal } from '../../src/components/CommentsModal'; // <--- Import Modal
import { useAuth } from '../../src/contexts/AuthContext'; // <--- Import Auth

let PagerView: any;
if (Platform.OS !== 'web') {
    try { PagerView = require('react-native-pager-view').default; } catch (e) { PagerView = View; }
} else { PagerView = View; }

const FeedCard = ({ drawing, canvasSize, isActive, forceStatic }: { drawing: any, canvasSize: number, isActive: boolean, forceStatic: boolean }) => {
    const { user } = useAuth();
    
    // États sociaux
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(drawing.likes_count || 0);
    const [showComments, setShowComments] = useState(false);
    
    // Infos Auteur (Chargées depuis la relation users)
    const author = drawing.users; 

    // Vérifier si j'ai déjà liké ce dessin au chargement
    useEffect(() => {
        if (user && isActive) {
            checkLikeStatus();
        }
    }, [user, isActive]);

    const checkLikeStatus = async () => {
        const { data } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', user?.id)
            .eq('drawing_id', drawing.id)
            .maybeSingle();
        setIsLiked(!!data);
    };

    const handleLike = async () => {
        if (!user) return; // TODO: Rediriger vers login ?
        
        // Optimistic UI (On change tout de suite l'affichage)
        const newLiked = !isLiked;
        setIsLiked(newLiked);
        setLikesCount((prev: number) => newLiked ? prev + 1 : prev - 1);

        try {
            if (newLiked) {
                await supabase.from('likes').insert({ user_id: user.id, drawing_id: drawing.id });
            } else {
                await supabase.from('likes').delete().eq('user_id', user.id).eq('drawing_id', drawing.id);
            }
        } catch (e) {
            // Rollback si erreur
            console.error(e);
            setIsLiked(!newLiked);
            setLikesCount((prev: number) => newLiked ? prev - 1 : prev + 1);
        }
    };

    const shouldAnimate = isActive && !forceStatic;

    return (
        <View style={styles.cardContainer}>
            {/* Dessin */}
            <View style={{ width: canvasSize, height: canvasSize }}>
                <DrawingViewer
                    imageUri={drawing.cloud_image_url}
                    canvasData={drawing.canvas_data}
                    viewerSize={canvasSize}
                    transparentMode={true} 
                    animated={shouldAnimate}
                    startVisible={!shouldAnimate} 
                />
            </View>

            {/* Infos */}
            <View style={styles.cardInfo}>
                <View style={styles.headerInfo}>
                    <Text style={styles.drawingTitle}>{drawing.label || "Sans titre"}</Text>
                    <View style={styles.userInfo}>
                         {/* Avatar Auteur */}
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
                    {/* Bouton LIKE connecté */}
                    <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                        <Heart 
                            color={isLiked ? "#FF3B30" : "#000"} 
                            fill={isLiked ? "#FF3B30" : "transparent"} 
                            size={28} 
                        />
                        <Text style={styles.actionText}>{likesCount}</Text>
                    </TouchableOpacity>

                    {/* Bouton COMMENTAIRES connecté */}
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
                        <MessageCircle color="#000" size={28} />
                        <Text style={styles.actionText}>{drawing.comments_count || 0}</Text>
                    </TouchableOpacity>

                    <View style={{flex: 1}} /> 
                    <TouchableOpacity><Share2 color="#000" size={24} /></TouchableOpacity>
                </View>
            </View>

            {/* MODALE COMMENTAIRES */}
            <CommentsModal 
                visible={showComments} 
                onClose={() => setShowComments(false)} 
                drawingId={drawing.id} 
            />
        </View>
    );
};

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
                // IMPORTANT : On fetch aussi les infos de l'user (auteur)
                const { data: drawingsData } = await supabase
                    .from('drawings')
                    .select('*, users(display_name, avatar_url)') // <--- Jointure
                    .eq('cloud_id', cloudData.id)
                    .order('created_at', { ascending: false })
                    .limit(50); 
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
                {backgroundUrl && (
                    <View style={{ position: 'absolute', top: 0, width: screenWidth, height: screenWidth, zIndex: -1 }}>
                        <DrawingViewer imageUri={backgroundUrl} canvasData={[]} viewerSize={screenWidth} transparentMode={false} />
                    </View>
                )}
                {drawings.length > 0 ? (
                    <PagerView style={{ flex: 1 }} initialPage={0} onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}>
                        {drawings.map((drawing, index) => (
                            <View key={drawing.id} style={{ flex: 1 }}>
                                <FeedCard 
                                    drawing={drawing} canvasSize={screenWidth} 
                                    isActive={index === currentIndex} 
                                    forceStatic={false}
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