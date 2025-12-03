import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Pressable, Image, Platform, Modal } from 'react-native';
import { useEffect, useState, useCallback, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff, XCircle, User, MessageCircle, X } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { CommentsModal } from '../../src/components/CommentsModal';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer'; // Import corrigé

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
    
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [showComments, setShowComments] = useState(false);

    const { width: screenWidth } = Dimensions.get('window');
    const SPACING = 1; 
    const ITEM_SIZE = (screenWidth - SPACING) / 2;

    const fetchGallery = async (searchQuery = searchText) => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            const { data: cloudData } = await supabase.from('clouds').select('id').eq('published_for', today).maybeSingle();

            if (!cloudData) {
                setDrawings([]);
                return;
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
                .select('*, users(display_name, avatar_url), likes(count), comments(count)')
                .eq('cloud_id', cloudData.id)
                .order('created_at', { ascending: false });

            if (onlyLiked && likedIds.length > 0) {
                query = query.in('id', likedIds);
            }

            if (searchQuery.trim().length > 0) query = query.ilike('label', `%${searchQuery.trim()}%`);
            
            const { data, error } = await query;
            if (error) throw error;
            setDrawings(data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { fetchGallery(); }, [onlyLiked]);
    
    useFocusEffect(useCallback(() => { 
        fetchGallery(); 
        
        return () => {
            setSelectedDrawing(null);
            setIsLiked(false);
            setShowComments(false);
        };
    }, []));

    useEffect(() => {
        if (selectedDrawing && user) {
            setLikesCount(selectedDrawing.likes?.[0]?.count || 0);
            
            const checkLikeStatus = async () => {
                const { count } = await supabase
                    .from('likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('drawing_id', selectedDrawing.id);
                
                setIsLiked(count !== null && count > 0);
            };
            checkLikeStatus();
        }
    }, [selectedDrawing, user]);

    const onRefresh = () => { setRefreshing(true); fetchGallery(); };
    const handleSearchSubmit = () => { setLoading(true); fetchGallery(); Keyboard.dismiss(); };
    const clearSearch = () => { setSearchText(''); setLoading(true); fetchGallery(''); Keyboard.dismiss(); };

    const openViewer = useCallback((drawing: any) => setSelectedDrawing(drawing), []);
    const closeViewer = () => { setSelectedDrawing(null); setIsLiked(false); };

    const handleLike = async () => {
        if (!user || !selectedDrawing) return;

        const previousLiked = isLiked;
        const previousCount = likesCount;

        const newLikedState = !previousLiked;
        const newCount = newLikedState ? previousCount + 1 : Math.max(0, previousCount - 1);

        setIsLiked(newLikedState);
        setLikesCount(newCount);

        try {
            if (previousLiked) {
                const { error } = await supabase
                    .from('likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('drawing_id', selectedDrawing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('likes')
                    .insert({
                        user_id: user.id,
                        drawing_id: selectedDrawing.id
                    });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Erreur like:", error);
            setIsLiked(previousLiked);
            setLikesCount(previousCount);
        }
    };

    const author = selectedDrawing?.users;
    const commentsCount = selectedDrawing?.comments?.[0]?.count || 0;

    const optimizedFullImage = selectedDrawing ? getOptimizedImageUrl(selectedDrawing.cloud_image_url, screenWidth) : null;
    const optimizedAvatar = author ? getOptimizedImageUrl(author.avatar_url, 50) : null;

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

                            <View style={styles.modalFooter}>
                                <View style={styles.userInfoRow}>
                                    <View style={styles.profilePlaceholder}>
                                        {author?.avatar_url ? (
                                            <Image source={{uri: optimizedAvatar || author.avatar_url}} style={{width:40, height:40, borderRadius:20}} />
                                        ) : (
                                            <User color="#FFF" size={20} />
                                        )}
                                    </View>
                                    <View>
                                        <Text style={styles.userName}>{author?.display_name || "Anonyme"}</Text>
                                        {selectedDrawing.label && <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>}
                                    </View>
                                </View>

                                <View style={styles.statsRow}>
                                    <TouchableOpacity style={styles.statItem} onPress={handleLike}>
                                        <Heart 
                                            color={isLiked ? "#FF3B30" : "#000"} 
                                            fill={isLiked ? "#FF3B30" : "transparent"} 
                                            size={24} 
                                        />
                                        <Text style={styles.statText}>{likesCount}</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity style={styles.statItem} onPress={() => setShowComments(true)}>
                                        <MessageCircle color="#000" size={24} />
                                        <Text style={styles.statText}>{commentsCount}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <CommentsModal 
                                visible={showComments} 
                                onClose={() => setShowComments(false)} 
                                drawingId={selectedDrawing.id} 
                            />
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
    fullScreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 50 },
    hintText: { position: 'absolute', bottom: 10, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width:1, height:1}, textShadowRadius: 1 },
    detailsFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', overflow:'hidden' },
    userName: { fontWeight: '700', fontSize: 14 },
    drawingLabel: { color: '#666', fontSize: 12, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 15 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statText: { fontWeight: '600', fontSize: 16 },
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, paddingTop: 10, backgroundColor: '#FFF', zIndex: 20 },
    closeModalBtn: { padding: 5 },
    modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
});