import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { useFocusEffect } from 'expo-router';

export default function GalleryPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Calculs pour la grille (Carrés parfaits)
    const { width: screenWidth } = Dimensions.get('window');
    const SPACING = 1; // Espace très fin pour effet mosaïque
    const ITEM_SIZE = (screenWidth - SPACING) / 2; // 2 colonnes

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
                height: ITEM_SIZE, // Carré strict
                marginBottom: SPACING,
                backgroundColor: '#EEE' // Fond gris le temps que ça charge
            }}
        >
            <DrawingViewer
                imageUri={item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                transparentMode={false}
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            
            {/* HEADER IDENTIQUE AU FEED (Sunbim) */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000" /></View>
            ) : (
                <FlatList
                    data={drawings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ gap: SPACING }}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 0 }}
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
    container: { 
        flex: 1, 
        backgroundColor: '#FFFFFF' 
    },
    loadingContainer: {
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center'
    },
    
    // --- HEADER STYLE FEED/INDEX ---
    headerBar: {
        width: '100%',
        backgroundColor: '#FFFFFF', 
        paddingTop: 60, 
        paddingBottom: 15,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        // Pas de bordure pour garder le style épuré
    },
    headerText: {
        fontSize: 32, 
        fontWeight: '900',
        // Blanc sur Blanc ? Non, le client veut "le même que le feed".
        // Sur le feed on avait mis Blanc + Ombre. Ici le fond est blanc.
        // Option A : Noir pur (plus lisible).
        // Option B : Blanc avec ombre (style signature).
        // Je mets NOIR ici pour la lisibilité sur fond blanc, sinon c'est invisible.
        // Si tu veux vraiment blanc+ombre sur fond blanc, dis le moi.
        color: '#000000', 
        letterSpacing: -1,
    },

    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999' }
});