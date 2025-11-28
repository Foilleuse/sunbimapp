import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Pressable, Image } from 'react-native';
import { useEffect, useState, useCallback, memo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff, XCircle, User, MessageCircle } from 'lucide-react-native';

// --- ITEM DE LISTE OPTIMISÉ ---
const GalleryItem = memo(({ item, itemSize, showClouds, onPress }: any) => {
    return (
        <TouchableOpacity 
            activeOpacity={0.9} onPress={() => onPress(item)}
            style={{ width: itemSize, height: itemSize, marginBottom: 1, backgroundColor: '#F9F9F9', overflow: 'hidden' }}
        >
            {/* Version statique (animated={false}) pour la liste : beaucoup plus rapide */}
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
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showClouds, setShowClouds] = useState(true);
    const [onlyLiked, setOnlyLiked] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);
    const [isHolding, setIsHolding] = useState(false);

    const { width: screenWidth } = Dimensions.get('window');
    const SPACING = 1; 
    const ITEM_SIZE = (screenWidth - SPACING) / 2;

    const fetchGallery = async (searchQuery = searchText) => {
        try {
            let query = supabase
                .from('drawings')
                .select('*, users(display_name, avatar_url)') 
                .order('created_at', { ascending: false })
                .limit(50);

            if (searchQuery.trim().length > 0) query = query.ilike('label', `%${searchQuery.trim()}%`);
            const { data, error } = await query;
            if (error) throw error;
            setDrawings(data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { fetchGallery(); }, []);
    useFocusEffect(useCallback(() => { fetchGallery(); }, []));

    const onRefresh = () => { setRefreshing(true); fetchGallery(); };
    const handleSearchSubmit = () => { setLoading(true); fetchGallery(); Keyboard.dismiss(); };
    const clearSearch = () => { setSearchText(''); setLoading(true); fetchGallery(''); Keyboard.dismiss(); };

    const openViewer = useCallback((drawing: any) => setSelectedDrawing(drawing), []);
    const closeViewer = () => setSelectedDrawing(null);

    const author = selectedDrawing?.users;

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
            <SunbimHeader showCloseButton={selectedDrawing !== null} onClose={closeViewer} showProfileButton={true} />
            <View style={{flex: 1, position: 'relative'}}>
                <View style={{flex: 1}}>
                    <View style={styles.toolsContainer}>
                        <View style={styles.searchBar}>
                            <Search color="#999" size={18} />
                            <TextInput placeholder="Rechercher..." placeholderTextColor="#999" style={styles.searchInput} value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearchSubmit} returnKeyType="search" />
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
                            // Optimisations FlatList standard
                            initialNumToRender={6}
                            windowSize={5}
                            removeClippedSubviews={Platform.OS === 'android'}
                            ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>Galerie vide.</Text></View>}
                        />
                    )}
                </View>

                {selectedDrawing && (
                    <View style={styles.fullScreenOverlay}>
                        <Pressable onPressIn={() => setIsHolding(true)} onPressOut={() => setIsHolding(false)} style={{ width: screenWidth, height: screenWidth, backgroundColor: '#F0F0F0' }}>
                            <DrawingViewer
                                imageUri={selectedDrawing.cloud_image_url} canvasData={isHolding ? [] : selectedDrawing.canvas_data}
                                viewerSize={screenWidth} transparentMode={!showClouds} startVisible={false} animated={true}
                            />
                            <Text style={styles.hintText}>Maintenir pour voir l'original</Text>
                        </Pressable>

                        {/* INFO FOOTER */}
                        <View style={styles.detailsFooter}>
                            
                            <View style={styles.userInfoRow}>
                                <View style={styles.profilePlaceholder}>
                                    {author?.avatar_url ? (
                                        <Image source={{uri: author.avatar_url}} style={{width:40, height:40, borderRadius:20}} />
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
                                <View style={styles.statItem}><Heart color="#000" size={24} /><Text style={styles.statText}>{selectedDrawing.likes_count || 0}</Text></View>
                                <View style={styles.statItem}><MessageCircle color="#000" size={24} /><Text style={styles.statText}>{selectedDrawing.comments_count || 0}</Text></View>
                            </View>
                        </View>
                    </View>
                )}
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
});