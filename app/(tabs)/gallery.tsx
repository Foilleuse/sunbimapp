import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Pressable, Image, Platform, Modal, Alert } from 'react-native';
import { useEffect, useState, useCallback, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff, XCircle, User, MessageCircle, X, MoreHorizontal, Lightbulb, Palette, Zap } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';

// Types de réactions possibles
type ReactionType = 'like' | 'smart' | 'beautiful' | 'crazy' | null;

// Composant mémorisé pour éviter les re-rendus inutiles
const GalleryItem = memo(({ item, itemSize, showClouds, onPress }: any) => {
    return (
        <TouchableOpacity 
            activeOpacity={0.9} onPress={() => onPress(item)}
            style={{ width: itemSize, aspectRatio: 3/4, marginBottom: 1, backgroundColor: '#F9F9F9', overflow: 'hidden' }}
        >
            <DrawingViewer
                imageUri={item.cloud_image_url} 
                canvasData={item.canvas_data} 
                viewerSize={itemSize}
                transparentMode={!showClouds} 
                startVisible={true} 
                animated={false} 
            />
        </TouchableOpacity>
    );
}, (prev, next) => {
    return prev.item.id === next.item.id && prev.showClouds === next.showClouds;
});

export default function GalleryPage() {
    const { user } = useAuth();
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showClouds, setShowClouds] = useState(true);
    const [onlyLiked, setOnlyLiked] = useState(false);
    const [searchText, setSearchText] = useState('');
    
    const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
    const [isHolding, setIsHolding] = useState(false);
    
    // États pour les réactions du dessin sélectionné
    const [userReaction, setUserReaction] = useState<ReactionType>(null);
    const [reactionCounts, setReactionCounts] = useState({
        like: 0,
        smart: 0,
        beautiful: 0,
        crazy: 0
    });

    const { width: screenWidth } = Dimensions.get('window');
    const SPACING = 1; 
    const ITEM_SIZE = (screenWidth - SPACING) / 2;

    const fetchGallery = async (searchQuery = searchText) => {
        try {
            if (!refreshing) setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            
            const { data: cloudData } = await supabase
                .from('clouds')
                .select('id, image_url')
                .eq('published_for', today)
                .maybeSingle();

            if (!cloudData) {
                setDrawings([]);
                setLoading(false);
                return;
            }

            if (cloudData.image_url) {
                const prefetchUrl = getOptimizedImageUrl(cloudData.image_url, ITEM_SIZE * 2);
                if (prefetchUrl) {
                    Image.prefetch(prefetchUrl).catch(e => console.log("Prefetch error (ignorable):", e));
                }
            }

            let blockedUserIds: string[] = [];
            if (user) {
                const { data: blocks } = await supabase
                    .from('blocks')
                    .select('blocked_id')
                    .eq('blocker_id', user.id);
                
                if (blocks && blocks.length > 0) {
                    blockedUserIds = blocks.map(b => b.blocked_id);
                }
            }

            let likedIds: string[] = [];
            if (onlyLiked && user) {
                const { data: userLikes } = await supabase
                    .from('likes')
                    .select('drawing_id')
                    .eq('user_id', user.id);
                
                if (!userLikes || userLikes.length === 0) {
                    setDrawings([]);
                    setLoading(false);
                    return;
                }
                likedIds = userLikes.map(l => l.drawing_id);
            }

            let query = supabase
                .from('drawings')
                .select('*, users(display_name, avatar_url)') // Plus besoin de counts ici
                .eq('cloud_id', cloudData.id)
                .eq('is_hidden', false) 
                .order('created_at', { ascending: false });

            if (blockedUserIds.length > 0) {
                query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
            }

            if (onlyLiked && likedIds.length > 0) {
                query = query.in('id', likedIds);
            }

            if (searchQuery.trim().length > 0) query = query.ilike('label', `%${searchQuery.trim()}%`);
            
            const { data, error } = await query;
            if (error) throw error;
            setDrawings(data || []);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
            setRefreshing(false); 
        }
    };

    useEffect(() => { fetchGallery(); }, [onlyLiked, user]); 
    
    useFocusEffect(useCallback(() => { 
        fetchGallery(); 
        return () => {
            setSelectedDrawing(null);
            setUserReaction(null);
            setReactionCounts({ like: 0, smart: 0, beautiful: 0, crazy: 0 });
        };
    }, []));

    // Chargement des réactions quand un dessin est ouvert
    useEffect(() => {
        if (selectedDrawing) {
            fetchReactionsState();
        }
    }, [selectedDrawing]);

    const onRefresh = () => { setRefreshing(true); fetchGallery(); };
    const handleSearchSubmit = () => { setLoading(true); fetchGallery(); Keyboard.dismiss(); };
    const clearSearch = () => { setSearchText(''); setLoading(true); fetchGallery(''); Keyboard.dismiss(); };

    const openViewer = useCallback((drawing: any) => setSelectedDrawing(drawing), []);
    
    const closeViewer = () => { 
        setSelectedDrawing(null); 
        setUserReaction(null);
        setReactionCounts({ like: 0, smart: 0, beautiful: 0, crazy: 0 });
    };

    const fetchReactionsState = async () => {
        if (!selectedDrawing) return;
        try {
            const { data: allReactions, error } = await supabase
                .from('reactions')
                .select('reaction_type, user_id')
                .eq('drawing_id', selectedDrawing.id);

            if (error) throw error;

            const counts = { like: 0, smart: 0, beautiful: 0, crazy: 0 };
            let myReaction: ReactionType = null;

            allReactions?.forEach((r: any) => {
                if (counts.hasOwnProperty(r.reaction_type)) {
                    counts[r.reaction_type as keyof typeof counts]++;
                }
                if (user && r.user_id === user.id) {
                    myReaction = r.reaction_type as ReactionType;
                }
            });

            setReactionCounts(counts);
            setUserReaction(myReaction);

        } catch (e) {
            console.error("Erreur chargement réactions:", e);
        }
    };

    const handleReaction = async (type: ReactionType) => {
        if (!user || !type || !selectedDrawing) return;

        const previousReaction = userReaction;
        const previousCounts = { ...reactionCounts };

        if (userReaction === type) {
            setUserReaction(null);
            setReactionCounts(prev => ({
                ...prev,
                [type]: Math.max(0, prev[type] - 1)
            }));
            
            try {
                await supabase.from('reactions').delete().eq('user_id', user.id).eq('drawing_id', selectedDrawing.id);
            } catch (e) {
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        } 
        else {
            setUserReaction(type);
            setReactionCounts(prev => {
                const newCounts = { ...prev };
                if (previousReaction) {
                    newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
                }
                newCounts[type]++;
                return newCounts;
            });

            try {
                const { error } = await supabase
                    .from('reactions')
                    .upsert({
                        user_id: user.id,
                        drawing_id: selectedDrawing.id,
                        reaction_type: type
                    }, { onConflict: 'user_id, drawing_id' });
                
                if (error) throw error;
            } catch (e) {
                console.error(e);
                setUserReaction(previousReaction);
                setReactionCounts(previousCounts);
            }
        }
    };

    const handleReport = () => {
        if (!selectedDrawing) return;
        Alert.alert(
            "Options",
            "Que souhaitez-vous faire ?",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Signaler le contenu", 
                    onPress: async () => {
                        if (!user) return Alert.alert("Erreur", "Vous devez être connecté pour signaler.");
                        try {
                            const { error } = await supabase
                                .from('reports')
                                .insert({ reporter_id: user.id, drawing_id: selectedDrawing.id, reason: 'Contenu inapproprié' });
                            
                            if (error) throw error;
                            Alert.alert("Signalement envoyé", "Nous allons examiner cette image. Merci de votre vigilance.");
                        } catch (e) {
                            console.error(e);
                            Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
                        }
                    }
                }
            ]
        );
    };

    const author = selectedDrawing?.users;
    
    // OPTIMISATION DES IMAGES MODALE
    const optimizedFullImage = selectedDrawing ? getOptimizedImageUrl(selectedDrawing.cloud_image_url, screenWidth) : null;
    
    const renderItem = useCallback(({ item }: { item: any }) => (
        <GalleryItem 
            item={item} 
            itemSize={ITEM_SIZE} 
            showClouds={showClouds} 
            onPress={openViewer} 
        />
    ), [showClouds, ITEM_SIZE, openViewer]);

    return (
        <View style={styles.container}>
            <SunbimHeader showCloseButton={false} onClose={closeViewer} showProfileButton={true} />
            <View style={{flex: 1, position: 'relative'}}>
                <View style={{flex: 1}}>
                    <View style={styles.toolsContainer}>
                        <View style={styles.searchBar}>
                            <Search color="#999" size={18} />
                            <TextInput placeholder="Rechercher aujourd'hui..." placeholderTextColor="#999" style={styles.searchInput} value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearchSubmit} returnKeyType="search" />
                            {searchText.length > 0 && <TouchableOpacity onPress={clearSearch}><XCircle color="#CCC" size={18} /></TouchableOpacity>}
                        </View>
                        <View style={styles.actionsRow}>
                            <TouchableOpacity style={[styles.actionBtn, onlyLiked && styles.activeBtn]} onPress={() => setOnlyLiked(!onlyLiked)}><Heart color={onlyLiked ? "#FFF" : "#000"} size={20} fill={onlyLiked ? "#FFF" : "transparent"}/></TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, !showClouds && styles.activeBtn]} onPress={() => setShowClouds(!showClouds)}>{showClouds ? (<Cloud color="#000" size={20} />) : (<CloudOff color="#FFF" size={20} />)}</TouchableOpacity>
                        </View>
                    </View>
                    {loading && !refreshing ? (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000" /></View>) : (
                        <FlatList
                            data={drawings} 
                            renderItem={renderItem} 
                            keyExtractor={(item) => item.id}
                            numColumns={2} 
                            columnWrapperStyle={{ gap: SPACING }} 
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000"/>}
                            initialNumToRender={6}
                            windowSize={5}
                            removeClippedSubviews={Platform.OS === 'android'}
                            ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>Aucun dessin pour ce nuage.</Text></View>}
                        />
                    )}
                </View>

                <Modal visible={!!selectedDrawing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeViewer}>
                    {selectedDrawing && (
                        <View style={styles.modalContainer}>
                             <View style={styles.modalHeader}>
                                  <TouchableOpacity onPress={closeViewer} style={styles.closeModalBtn}>
                                      <X color="#000" size={30} />
                                  </TouchableOpacity>
                              </View>

                            <Pressable onPressIn={() => setIsHolding(true)} onPressOut={() => setIsHolding(false)} style={{ width: screenWidth, aspectRatio: 3/4, backgroundColor: '#F0F0F0' }}>
                                <Image 
                                    source={{ uri: optimizedFullImage || selectedDrawing.cloud_image_url }}
                                    style={[StyleSheet.absoluteFill, { opacity: 1 }]}
                                    resizeMode="cover"
                                />
                                <View style={{ flex: 1, opacity: isHolding ? 0 : 1 }}>
                                    <DrawingViewer
                                        imageUri={selectedDrawing.cloud_image_url} canvasData={selectedDrawing.canvas_data}
                                        viewerSize={screenWidth} 
                                        transparentMode={true} 
                                        startVisible={false} 
                                        animated={true}
                                    />
                                </View>
                                <Text style={styles.hintText}>Maintenir pour voir l'original</Text>
                            </Pressable>

                            {/* --- NOUVEAU FOOTER STYLE FEED --- */}
                            <View style={styles.infoCard}>
                                <View style={styles.infoContent}>
                                    <View style={styles.titleRow}>
                                        <Text style={styles.drawingTitle} numberOfLines={1}>
                                            {selectedDrawing.label || "Sans titre"}
                                        </Text>
                                        
                                        <TouchableOpacity onPress={handleReport} style={styles.moreBtnAbsolute} hitSlop={15}>
                                            <MoreHorizontal color="#CCC" size={24} />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>

                                    {/* BARRE DE RÉACTIONS */}
                                    <View style={styles.reactionBar}>
                                        <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('like')}>
                                            <Heart color={userReaction === 'like' ? "#FF3B30" : "#000"} fill={userReaction === 'like' ? "#FF3B30" : "transparent"} size={24} />
                                            <Text style={[styles.reactionText, userReaction === 'like' && styles.activeText]}>{reactionCounts.like}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('smart')}>
                                            <Lightbulb color={userReaction === 'smart' ? "#FFCC00" : "#000"} fill={userReaction === 'smart' ? "#FFCC00" : "transparent"} size={24} />
                                            <Text style={[styles.reactionText, userReaction === 'smart' && styles.activeText]}>{reactionCounts.smart}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('beautiful')}>
                                            <Palette color={userReaction === 'beautiful' ? "#5856D6" : "#000"} fill={userReaction === 'beautiful' ? "#5856D6" : "transparent"} size={24} />
                                            <Text style={[styles.reactionText, userReaction === 'beautiful' && styles.activeText]}>{reactionCounts.beautiful}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.reactionBtn} onPress={() => handleReaction('crazy')}>
                                            <Zap color={userReaction === 'crazy' ? "#FF2D55" : "#000"} fill={userReaction === 'crazy' ? "#FF2D55" : "transparent"} size={24} />
                                            <Text style={[styles.reactionText, userReaction === 'crazy' && styles.activeText]}>{reactionCounts.crazy}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                        </View>
                    )}
                </Modal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    toolsContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 15, paddingTop: 10, alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#000', height: '100%' },
    actionsRow: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
    activeBtn: { backgroundColor: '#000', borderColor: '#000' },
    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999' },
    hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, paddingTop: 10, backgroundColor: '#FFF', zIndex: 20 },
    closeModalBtn: { padding: 5 },
    
    // NOUVEAUX STYLES (Feed Card Style)
    infoCard: {
        width: '100%',
        padding: 20, 
        backgroundColor: '#FFF',
        borderTopWidth: 1, 
        borderTopColor: '#F0F0F0',
        marginTop: 10, 
    },
    infoContent: {
        alignItems: 'center'
    },
    titleRow: { 
        width: '100%',
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 2,
        position: 'relative'
    },
    drawingTitle: { 
        fontSize: 26, 
        fontWeight: '900', 
        color: '#000', 
        letterSpacing: -0.5, 
        textAlign: 'center',
        maxWidth: '80%' 
    },
    moreBtnAbsolute: { 
        position: 'absolute',
        right: 0,
        top: 5,
        padding: 5 
    },
    userName: { 
        fontSize: 13, 
        fontWeight: '500', 
        color: '#888',
        marginBottom: 10
    },
    reactionBar: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        width: '100%',
        paddingHorizontal: 10
    },
    reactionBtn: { 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 8
    },
    reactionText: { 
        fontSize: 12, 
        fontWeight: '600', 
        color: '#999',
        marginTop: 4 
    },
    activeText: {
        color: '#000',
        fontWeight: '800'
    }
});