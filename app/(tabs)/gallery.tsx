import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Pressable, Image, Platform, Modal, Alert, PixelRatio } from 'react-native';
import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff, XCircle, User } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
// Import de la nouvelle modale
import { DrawingDetailModal } from '../../src/components/DrawingDetailModal';
// Import du composant de flou
import { BlurView } from 'expo-blur';
// Import pour gérer la zone de sécurité (encoche, status bar)
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- COMPOSANT VIGNETTE ---
const GalleryItem = memo(({ item, itemSize, showClouds, onPress }: any) => {
    
    // 🔥 VIGNETTE : On force le ratio 3:4
    const targetHeight = itemSize * (4/3);

    const optimizedUri = useMemo(() => {
        if (!item.cloud_image_url) return null;
        const physicalWidth = Math.round(itemSize * PixelRatio.get());
        const physicalHeight = Math.round(targetHeight * PixelRatio.get()); 
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
                viewerHeight={targetHeight} 
                transparentMode={!showClouds} 
                startVisible={true} 
                animated={false} 
                autoCenter={false} 
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
    
    // Hauteur dynamique du header pour le padding de la liste
    const [headerHeight, setHeaderHeight] = useState(130); 
    
    // Récupération des insets pour la Safe Area
    const insets = useSafeAreaInsets();

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

            // --- FILTRE "ONLY LIKED" via la table REACTIONS ---
            let likedIds: string[] = [];
            if (onlyLiked && user) {
                const { data: userReactions } = await supabase
                    .from('reactions')
                    .select('drawing_id')
                    .eq('user_id', user.id)
                    .eq('reaction_type', 'like'); // On filtre spécifiquement les likes

                if (!userReactions || userReactions.length === 0) {
                    setDrawings([]);
                    setLoading(false);
                    return;
                }
                likedIds = userReactions.map(l => l.drawing_id);
            }

            let query = supabase
                .from('drawings')
                .select('*, users(display_name, avatar_url)')
                .eq('cloud_id', cloudData.id)
                .eq('is_hidden', false) 
                .order('created_at', { ascending: false });

            if (blockedUserIds.length > 0) query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
            
            // Application du filtre sur les IDs likés
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
            {/* LISTE EN PLEIN ÉCRAN (Z-INDEX BAS) */}
            <View style={{flex: 1}}>
                {loading && !refreshing ? (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000" /></View>) : (
                    <FlatList
                        data={drawings} 
                        renderItem={renderItem} 
                        keyExtractor={(item) => item.id}
                        numColumns={2} 
                        columnWrapperStyle={{ gap: SPACING }} 
                        // PaddingTop dynamique pour compenser le header absolu
                        contentContainerStyle={{ paddingBottom: 100, paddingTop: headerHeight }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" progressViewOffset={headerHeight}/>}
                        initialNumToRender={6}
                        windowSize={5}
                        removeClippedSubviews={Platform.OS === 'android'}
                        ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No drawings found.</Text></View>}
                    />
                )}
            </View>

            {/* HEADER TRANSPARENT & FLOUTÉ (Z-INDEX HAUT) */}
            {/* On applique le padding top ici pour respecter la Safe Area */}
            <BlurView 
                intensity={80} 
                tint="light" 
                style={[styles.absoluteHeader, { paddingTop: insets.top }]}
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
            >
                <SunbimHeader showCloseButton={false} onClose={closeViewer} transparent={true} /> 
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
                {/* Bordure subtile pour séparer le header du contenu défilant dessous */}
                <View style={styles.headerSeparator} />
            </BlurView>

            {/* MODALE DÉTAIL VIA COMPOSANT */}
            {selectedDrawing && (
                <DrawingDetailModal
                    visible={!!selectedDrawing}
                    onClose={closeViewer}
                    drawing={selectedDrawing}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header Absolute Styles
    absoluteHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        // Le backgroundColor est géré par BlurView (tint)
    },
    toolsContainer: { 
        flexDirection: 'row', 
        paddingHorizontal: 15, 
        paddingBottom: 10, 
        paddingTop: 5, 
        alignItems: 'center', 
        gap: 10,
        marginTop: 50, // On pousse les outils vers le bas pour ne pas chevaucher le titre "nyola"
    },
    headerSeparator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        width: '100%',
    },

    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#000', height: '100%' },
    actionsRow: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
    activeBtn: { backgroundColor: '#000', borderColor: '#000' },
    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999' },
});