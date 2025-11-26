import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff } from 'lucide-react-native';

export default function GalleryPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- NOUVEAUX ÉTATS POUR LES FILTRES ---
    const [showClouds, setShowClouds] = useState(true); // Afficher/Masquer les photos
    const [onlyLiked, setOnlyLiked] = useState(false); // Filtre "Likes" (visuel pour l'instant)
    const [searchText, setSearchText] = useState(''); // Recherche

    const { width: screenWidth } = Dimensions.get('window');
    const SPACING = 1; 
    const ITEM_SIZE = (screenWidth - SPACING) / 2;

    const fetchGallery = async () => {
        try {
            const { data, error } = await supabase
                .from('drawings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); 

            if (error) throw error;
            setDrawings(data || []);
        } catch (e) {
            console.error("Erreur galerie:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchGallery(); }, []);

    useFocusEffect(
        useCallback(() => { fetchGallery(); }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchGallery();
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            activeOpacity={0.9}
            style={{ 
                width: ITEM_SIZE, 
                height: ITEM_SIZE, 
                marginBottom: SPACING,
                backgroundColor: '#F9F9F9', // Gris très clair quand pas de photo
                overflow: 'hidden'
            }}
        >
            <DrawingViewer
                imageUri={item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                // LA MAGIE EST ICI : On passe l'état du switch
                transparentMode={!showClouds} 
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            
            {/* 1. HEADER (Style Signature : Blanc Ombré) */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
            </View>

            {/* 2. BARRE D'OUTILS (Recherche + Filtres) */}
            <View style={styles.toolsContainer}>
                
                {/* Barre de recherche */}
                <View style={styles.searchBar}>
                    <Search color="#999" size={18} />
                    <TextInput 
                        placeholder="Rechercher un tag..." 
                        placeholderTextColor="#999"
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>

                {/* Boutons d'action */}
                <View style={styles.actionsRow}>
                    {/* Bouton Like (Filtre) */}
                    <TouchableOpacity 
                        style={[styles.actionBtn, onlyLiked && styles.activeBtn]}
                        onPress={() => setOnlyLiked(!onlyLiked)}
                    >
                        <Heart 
                            color={onlyLiked ? "#FFF" : "#000"} 
                            size={20} 
                            fill={onlyLiked ? "#FFF" : "transparent"}
                        />
                    </TouchableOpacity>

                    {/* Bouton Nuage (Toggle Photo) */}
                    <TouchableOpacity 
                        style={[styles.actionBtn, !showClouds && styles.activeBtn]} // Actif si on cache les nuages (mode dessin pur)
                        onPress={() => setShowClouds(!showClouds)}
                    >
                        {showClouds ? (
                            <Cloud color="#000" size={20} />
                        ) : (
                            <CloudOff color="#FFF" size={20} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* 3. GRILLE */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000" /></View>
            ) : (
                <FlatList
                    data={drawings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ gap: SPACING }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000"/>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Galerie vide.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // HEADER IDENTIQUE FEED
    headerBar: {
        width: '100%',
        backgroundColor: '#FFFFFF', 
        paddingTop: 60, 
        paddingBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    headerText: {
        fontSize: 32, 
        fontWeight: '900',
        color: '#FFFFFF', // Blanc
        textShadowColor: 'rgba(0, 0, 0, 0.5)', 
        textShadowOffset: { width: 2, height: 2 }, 
        textShadowRadius: 0,
        letterSpacing: -1,
    },

    // BARRE D'OUTILS
    toolsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingBottom: 15,
        alignItems: 'center',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 40,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#000',
        height: '100%',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#EEE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeBtn: {
        backgroundColor: '#000',
        borderColor: '#000',
    },

    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999' }
});