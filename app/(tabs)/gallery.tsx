import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Pressable, Image, Platform, Modal, Alert, PixelRatio, SafeAreaView } from 'react-native';
import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff, XCircle, User, MessageCircle, X, MoreHorizontal, Lightbulb, Palette, Zap } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
// Import de la nouvelle modale
import { DrawingDetailModal } from '../../src/components/DrawingDetailModal';

// --- COMPOSANT VIGNETTE ---
const GalleryItem = memo(({ item, itemSize, showClouds, onPress }: any) => {
    
    // 🔥 VIGNETTE : On force le ratio 3:4
    // Calcul de la hauteur cible pour le viewer (ratio 3:4 = largeur * 1.333)
    const targetHeight = itemSize * (4/3);

    const optimizedUri = useMemo(() => {
        if (!item.cloud_image_url) return null;
        
        // 1. Dimensions réelles
        const physicalWidth = Math.round(itemSize * PixelRatio.get());
        // 2. Calcul de la hauteur 3:4
        const physicalHeight = Math.round(targetHeight * PixelRatio.get()); // Utiliser la hauteur calculée

        // 3. On passe width ET height ➔ L'optimiseur active le "Crop"
        return getOptimizedImageUrl(item.cloud_image_url, physicalWidth, physicalHeight);
    }, [item.cloud_image_url, itemSize, targetHeight]);

    return (
        <TouchableOpacity 
            activeOpacity={0.9} onPress={() => onPress(item)}
            style={{ width: itemSize, height: targetHeight, marginBottom: 1, backgroundColor: '#F9F9F9', overflow: 'hidden' }}
        >
            <DrawingViewer
                imageUri={optimizedUri || item.cloud_image_url} 
                canvasData={item.canvas_data} 
                viewerSize={itemSize}
                viewerHeight={targetHeight} // Ajout explicite de la hauteur
                transparentMode={!showClouds} 
                startVisible={true} 
                animated={false} 
                autoCenter={false} // Pas d'auto-center pour respecter le cadrage original
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

            // 🔥 PREFETCH : On demande aussi le 3:4 pour matcher le cache de la vignette
            if (cloudData.image_url) {
                const targetWidth = Math.round(ITEM_SIZE * PixelRatio.get());
                const targetHeight = Math.round((targetWidth / 3) * 4);
                
                const prefetchUrl = getOptimizedImageUrl(cloudData.image_url, targetWidth, targetHeight);
                if (prefetchUrl) {
                    Image.prefetch(prefetchUrl).catch(e => console.log("Prefetch error:", e));
                }
            }

            let blockedUserIds: string[] = [];
            if (user) {
                const { data: blocks } = await supabase
                    .from('blocks')
                    .select('blocked_id')
                    .eq('blocker_id', user.id);
                if (blocks) blockedUserIds = blocks.map(b => b.blocked_id);
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
                .select('*, users(display_name, avatar_url)')
                .eq('cloud_id', cloudData.id)
                .eq('is_hidden', false) 
                .order('created_at', { ascending: false });

            if (blockedUserIds.length > 0) query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
            if (onlyLiked && likedIds.length > 0) query = query.in('id', likedIds);
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
    useFocusEffect(useCallback(() => { fetchGallery(); return () => closeViewer(); }, []));

    const onRefresh = () => { setRefreshing(true); fetchGallery(); };
    const handleSearchSubmit = () => { setLoading(true); fetchGallery(); Keyboard.dismiss(); };
    const clearSearch = () => { setSearchText(''); setLoading(true); fetchGallery(''); Keyboard.dismiss(); };
    const openViewer = useCallback((drawing: any) => setSelectedDrawing(drawing), []);
    
    const closeViewer = () => { 
        setSelectedDrawing(null); 
    };

    const renderItem = useCallback(({ item }: { item: any }) => (
        <GalleryItem item={item} itemSize={ITEM_SIZE} showClouds={showClouds} onPress={openViewer} />
    ), [showClouds, ITEM_SIZE, openViewer]);

    return (
        <View style={styles.container}>
            <SunbimHeader showCloseButton={false} onClose={closeViewer} /> 
            <View style={{flex: 1, position: 'relative'}}>
                <View style={{flex: 1}}>
                    <View style={styles.toolsContainer}>
                        <View style={styles.searchBar}>
                            <Search color="#999" size={18} />
                            <TextInput placeholder="Search..." placeholderTextColor="#999" style={styles.searchInput} value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearchSubmit} returnKeyType="search" />
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
                            ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No drawings.</Text></View>}
                        />
                    )}
                </View>

                {/* MODALE DÉTAIL VIA COMPOSANT */}
                {selectedDrawing && (
                    <DrawingDetailModal
                        visible={!!selectedDrawing}
                        onClose={closeViewer}
                        drawing={selectedDrawing}
                        // L'auteur est déjà dans selectedDrawing.users via la jointure dans fetchGallery
                    />
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
});