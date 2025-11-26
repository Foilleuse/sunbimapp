import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { useFocusEffect } from 'expo-router'; // Pour rafraîchir quand on arrive sur l'onglet

export default function GalleryPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Calculs pour la grille (2 colonnes avec un petit espace)
    const { width: screenWidth } = Dimensions.get('window');
    const SPACING = 2; // Espace blanc entre les images
    // La taille d'un carré = (Largeur écran - l'espace du milieu) / 2
    const ITEM_SIZE = (screenWidth - SPACING) / 2;

    // Fonction de chargement
    const fetchGallery = async () => {
        try {
            const { data, error } = await supabase
                .from('drawings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); // On charge les 50 derniers

            if (error) throw error;
            setDrawings(data || []);
        } catch (e) {
            console.error("Erreur galerie:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Charge au démarrage
    useEffect(() => {
        fetchGallery();
    }, []);

    // Re-charge à chaque fois qu'on clique sur l'onglet Galerie (pour voir les nouveaux)
    useFocusEffect(
        useCallback(() => {
            fetchGallery();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchGallery();
    };

    // Le rendu d'une seule tuile (Vignette)
    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={{ width: ITEM_SIZE, height: ITEM_SIZE, marginBottom: SPACING }}
            activeOpacity={0.9}
            // Plus tard: onPress={() => ouvrirDetail(item)}
        >
            {/* On réutilise le viewer en mode 'miniature' */}
            <DrawingViewer
                imageUri={item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                transparentMode={false} // On veut voir le nuage en fond
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            
            {/* HEADER (Style unifié) */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>galerie</Text>
            </View>

            {/* GRILLE */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                </View>
            ) : (
                <FlatList
                    data={drawings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2} // LA CLÉ : 2 Colonnes
                    columnWrapperStyle={{ gap: SPACING }} // Espace horizontal
                    contentContainerStyle={{ paddingBottom: 100 }} // Espace pour scroller en bas
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000"/>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>La galerie est vide.</Text>
                            <Text style={styles.emptySubText}>Poste le premier dessin !</Text>
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
    
    // HEADER
    headerBar: {
        width: '100%',
        backgroundColor: '#FFFFFF', 
        paddingTop: 60, 
        paddingBottom: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        zIndex: 10,
    },
    headerText: {
        fontSize: 24, // Un peu plus petit que l'accueil pour la hiérarchie
        fontWeight: '900',
        color: '#000',
        letterSpacing: -0.5,
    },

    // EMPTY STATE
    emptyState: {
        marginTop: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        marginTop: 5
    }
});