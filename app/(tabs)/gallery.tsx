import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, PixelRatio, Keyboard } from 'react-native';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { Search, Heart, XCircle } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { getOptimizedImageUrl } from '../../src/utils/imageOptimizer';
import { Canvas, Rect, LinearGradient as SkiaGradient, vec, useImage, Image as SkiaImage, Group, Blur, Mask, Paint } from "@shopify/react-native-skia";
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawingDetailModal } from '../../src/components/DrawingDetailModal';

// --- BACKGROUND MIROIR ---
const MirroredBackground = ({ uri, width, height }: { uri: string, width: number, height: number }) => {
    const image = useImage(uri);
    
    if (!image) return null;

    const top = 0;
    const BLUR_RADIUS = 60; 

    const EXTRA_WIDTH = 100;
    const bgWidth = width + EXTRA_WIDTH;
    const bgX = -EXTRA_WIDTH / 2;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group layer={<Paint><Blur blur={BLUR_RADIUS} /></Paint>}>
                <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                <Group origin={vec(width / 2, height/2)} transform={[{ scaleY: -1 }]}>
                    <SkiaImage image={image} x={bgX} y={top} width={bgWidth} height={height} fit="cover" />
                </Group>
            </Group>
        </Canvas>
    );
};

export default function GalleryPage() {
    const { user } = useAuth();
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [onlyLiked, setOnlyLiked] = useState(false);
    const [backgroundCloud, setBackgroundCloud] = useState<string | null>(null);

    // Modal Details
    const [selectedDrawing, setSelectedDrawing] = useState<any>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    
    const [headerHeight, setHeaderHeight] = useState(130);
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // Calcul taille grille
    const COLUMN_COUNT = 3;
    const SPACING = 2;
    const ITEM_SIZE = (screenWidth - (SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

    useFocusEffect(
        useCallback(() => {
            fetchGallery();
        }, [user, onlyLiked]) // On recharge si le filtre change
    );

    const fetchGallery = async (searchQuery = searchText) => {
        try {
            if (!refreshing) setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            
            const { data: cloudData } = await supabase
                .from('clouds')
                .select('id, image_url')
                .eq('published_for', today)
                .maybeSingle();

            if (cloudData) {
                setBackgroundCloud(cloudData.image_url);
            } else {
                setLoading(false);
                return;
            }

            let blockedUserIds: string[] = [];
            let reportedDrawingIds: string[] = [];

            if (user) {
                // 1. Récupération des utilisateurs bloqués
                const { data: blocks } = await supabase
                    .from('blocks')
                    .select('blocked_id')
                    .eq('blocker_id', user.id);
                
                if (blocks && blocks.length > 0) {
                    blockedUserIds = blocks.map(b => b.blocked_id);
                }

                // 2. Récupération des dessins signalés (Dynamique)
                const { data: reports } = await supabase
                    .from('reports')
                    .select('drawing_id')
                    .eq('reporter_id', user.id);
                
                if (reports && reports.length > 0) {
                    reportedDrawingIds = reports.map(r => r.drawing_id);
                }
            }

            let likedIds: string[] = [];
            if (onlyLiked && user) {
                const { data: userLikes } = await supabase
                    .from('reactions')
                    .select('drawing_id')
                    .eq('user_id', user.id)
                    .eq('reaction_type', 'like');
                
                if (userLikes) likedIds = userLikes.map(l => l.drawing_id);
            }

            let query = supabase
                .from('drawings')
                .select('*, users(display_name, avatar_url)')
                .eq('cloud_id', cloudData.id)
                .eq('is_hidden', false) 
                .order('created_at', { ascending: false });

            // Exclusion des utilisateurs bloqués
            if (blockedUserIds.length > 0) {
                query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
            }
            
            // Exclusion des dessins signalés (Correction : Exclusion explicite basée sur la liste récupérée)
            if (reportedDrawingIds.length > 0) {
                query = query.not('id', 'in', `(${reportedDrawingIds.join(',')})`);
            }
            
            // Filtre "Aimés uniquement"
            if (onlyLiked) {
                if (likedIds.length > 0) {
                    query = query.in('id', likedIds);
                } else {
                    setDrawings([]);
                    setLoading(false);
                    return;
                }
            }

            // Recherche textuelle
            if (searchQuery.trim().length > 0) {
                query = query.ilike('label', `%${searchQuery.trim()}%`);
            }
            
            const { data, error } = await query;
            if (error) throw error;

            setDrawings(data || []);

        } catch (e) {
            console.error("Error fetching gallery:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchText(text);
        fetchGallery(text);
    };

    const clearSearch = () => {
        setSearchText('');
        Keyboard.dismiss();
        fetchGallery('');
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchGallery();
    };

    const optimizedBackground = useMemo(() => {
        if (!backgroundCloud) return null;
        const w = Math.round(screenWidth * PixelRatio.get());
        const h = Math.round(screenHeight * PixelRatio.get());
        return getOptimizedImageUrl(backgroundCloud, w, h);
    }, [backgroundCloud, screenWidth, screenHeight]);

    const renderItem = ({ item }: { item: any }) => {
        const thumbUrl = getOptimizedImageUrl(item.image_url, 300, 300); // Miniature
        return (
            <TouchableOpacity 
                style={{ width: ITEM_SIZE, height: ITEM_SIZE, marginBottom: SPACING, marginRight: SPACING }}
                onPress={() => {
                    setSelectedDrawing(item);
                    setIsDetailModalVisible(true);
                }}
            >
                <Image 
                    source={{ uri: thumbUrl }} 
                    style={{ width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.1)' }} 
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {backgroundCloud && (
                <MirroredBackground 
                    uri={optimizedBackground || backgroundCloud}
                    width={screenWidth}
                    height={screenHeight} 
                />
            )}

            <BlurView 
                intensity={80} 
                tint="light" 
                style={[styles.absoluteHeader, { paddingTop: insets.top }]}
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
            >
                <SunbimHeader showCloseButton={false} transparent={true} />
                
                <View style={styles.toolsContainer}>
                    <View style={styles.searchBar}>
                        <Search size={18} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search..."
                            placeholderTextColor="#999"
                            value={searchText}
                            onChangeText={handleSearch}
                            returnKeyType="search"
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={clearSearch}>
                                <XCircle size={18} color="#CCC" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity 
                        style={[styles.filterBtn, onlyLiked && styles.filterBtnActive]}
                        onPress={() => setOnlyLiked(!onlyLiked)}
                    >
                        <Heart size={20} color={onlyLiked ? "#FFF" : "#666"} fill={onlyLiked ? "#FFF" : "transparent"} />
                    </TouchableOpacity>
                </View>
                <View style={styles.headerSeparator} />
            </BlurView>

            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator style={{marginTop: headerHeight + 50}} color="#000" />
                ) : (
                    <FlatList
                        data={drawings}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={{ paddingTop: headerHeight + 10, paddingBottom: 100 }}
                        columnWrapperStyle={{ gap: SPACING }} // Si supporté, sinon gérer avec marginRight
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No drawings found.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* MODALE DETAIL */}
            {selectedDrawing && (
                <DrawingDetailModal
                    visible={isDetailModalVisible}
                    onClose={() => setIsDetailModalVisible(false)}
                    drawing={selectedDrawing}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    absoluteHeader: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    },
    toolsContainer: {
        flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 10, paddingTop: 5, marginTop: 50, gap: 10
    },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8
    },
    searchInput: { flex: 1, fontSize: 14, color: '#000', height: '100%' },
    filterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
    filterBtnActive: { backgroundColor: '#FF3B30' },
    headerSeparator: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', width: '100%' },
    content: { flex: 1 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#000', fontSize: 16 }
});