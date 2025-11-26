import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Modal, Image } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { useFocusEffect } from 'expo-router';
// Ajout des icônes pour la modale (X, Message, User pour le profil)
import { Search, Heart, Cloud, CloudOff, XCircle, X, MessageCircle, User } from 'lucide-react-native';

export default function GalleryPage() {
    const [drawings, setDrawings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- ETATS FILTRES ---
    const [showClouds, setShowClouds] = useState(true);
    const [onlyLiked, setOnlyLiked] = useState(false);
    const [searchText, setSearchText] = useState('');

    // --- NOUVEAU : ÉTAT POUR LA MODALE ---
    // Si c'est null, la modale est fermée. Si y'a un dessin, elle est ouverte.
    const [selectedDrawing, setSelectedDrawing] = useState<any | null>(null);

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const SPACING = 1; 
    const ITEM_SIZE = (screenWidth - SPACING) / 2;

    // Fonction de recherche (inchangée)
    const fetchGallery = async (searchQuery = searchText) => {
        try {
            let query = supabase
                .from('drawings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (searchQuery.trim().length > 0) {
                query = query.ilike('label', `%${searchQuery.trim()}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setDrawings(data || []);
        } catch (e) {
            console.error("Erreur galerie:", e);
        } finally {
            setLoading(false); setRefreshing(false);
        }
    };

    useEffect(() => { fetchGallery(); }, []);
    useFocusEffect(callback(() => { fetchGallery(); }, []));

    const onRefresh = () => { setRefreshing(true); fetchGallery(); };
    const handleSearchSubmit = () => { setLoading(true); fetchGallery(); Keyboard.dismiss(); };
    const clearSearch = () => { setSearchText(''); setLoading(true); fetchGallery(''); Keyboard.dismiss(); };

    // Fonction pour ouvrir la modale
    const openModal = (drawing: any) => {
        setSelectedDrawing(drawing);
    };

    // Fonction pour fermer la modale
    const closeModal = () => {
        setSelectedDrawing(null);
    };

    // Rendu d'une vignette (mise à jour avec le onPress)
    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => openModal(item)} // <--- CLIC ICI
            style={{ 
                width: ITEM_SIZE, height: ITEM_SIZE, marginBottom: SPACING,
                backgroundColor: '#F9F9F9', overflow: 'hidden'
            }}
        >
            <DrawingViewer
                imageUri={item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                transparentMode={!showClouds} 
                // Dans la galerie, pas d'animation, on veut voir direct
                startVisible={true}
                animated={false}
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            
            {/* HEADER & TOOLS (Inchangés) */}
            <View style={styles.headerBar}><Text style={styles.headerText}>sunbim</Text></View>
            <View style={styles.toolsContainer}>
                <View style={styles.searchBar}>
                    <Search color="#999" size={18} />
                    <TextInput 
                        placeholder="Rechercher un tag..." placeholderTextColor="#999"
                        style={styles.searchInput} value={searchText} onChangeText={setSearchText}
                        onSubmitEditing={handleSearchSubmit} returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={clearSearch}><XCircle color="#CCC" size={18} /></TouchableOpacity>
                    )}
                </View>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionBtn, onlyLiked && styles.activeBtn]} onPress={() => setOnlyLiked(!onlyLiked)}>
                        <Heart color={onlyLiked ? "#FFF" : "#000"} size={20} fill={onlyLiked ? "#FFF" : "transparent"}/>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, !showClouds && styles.activeBtn]} onPress={() => setShowClouds(!showClouds)}>
                        {showClouds ? (<Cloud color="#000" size={20} />) : (<CloudOff color="#FFF" size={20} />)}
                    </TouchableOpacity>
                </View>
            </View>

            {/* GRILLE (Inchangée) */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000" /></View>
            ) : (
                <FlatList
                    data={drawings} renderItem={renderItem} keyExtractor={(item) => item.id}
                    numColumns={2} columnWrapperStyle={{ gap: SPACING }} contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000"/>}
                    ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>{searchText ? `Aucun résultat pour "${searchText}"` : "Galerie vide."}</Text></View>}
                />
            )}

            {/* --- NOUVEAU : LA MODALE POP-UP --- */}
            <Modal
                animationType="slide" // Apparaît du bas vers le haut
                transparent={false}
                visible={selectedDrawing !== null} // S'affiche si un dessin est sélectionné
                onRequestClose={closeModal} // Gère le bouton retour Android
            >
                {selectedDrawing && (
                    <View style={styles.modalContainer}>
                        
                        {/* 1. Header Modale (Croix) */}
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeModal} style={styles.closeModalBtn}>
                                <X color="#000" size={32} />
                            </TouchableOpacity>
                        </View>

                        {/* 2. L'Image en GRAND */}
                        <View style={{ width: screenWidth, height: screenWidth, backgroundColor: '#F0F0F0' }}>
                            <DrawingViewer
                                imageUri={selectedDrawing.cloud_image_url}
                                canvasData={selectedDrawing.canvas_data}
                                viewerSize={screenWidth} // Taille écran complet
                                transparentMode={!showClouds} // Respecte le filtre de la galerie
                                startVisible={true} // On veut voir direct
                                animated={false} // Pas d'animation ici pour l'instant
                            />
                        </View>

                        {/* 3. Footer Infos (Placeholders) */}
                        <View style={styles.modalFooter}>
                            
                            {/* Info Profil (Gauche) */}
                            <View style={styles.userInfoRow}>
                                {/* Placeholder photo de profil */}
                                <View style={styles.profilePlaceholder}>
                                    <User color="#FFF" size={20} />
                                </View>
                                <View>
                                    <Text style={styles.userName}>Utilisateur anonyme</Text>
                                    {/* Affiche le tag s'il existe */}
                                    {selectedDrawing.label && <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>}
                                </View>
                            </View>

                            {/* Stats Likes/Coms (Droite) */}
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Heart color="#000" size={24} />
                                    <Text style={styles.statText}>0</Text> {/* Placeholder */}
                                </View>
                                <View style={styles.statItem}>
                                    <MessageCircle color="#000" size={24} />
                                    <Text style={styles.statText}>0</Text> {/* Placeholder */}
                                </View>
                            </View>

                        </View>
                    </View>
                )}
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // HEADER & TOOLS (Inchangés)
    headerBar: { width: '100%', backgroundColor: '#FFFFFF', paddingTop: 60, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    headerText: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0, letterSpacing: -1 },
    toolsContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 15, alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#000', height: '100%' },
    actionsRow: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
    activeBtn: { backgroundColor: '#000', borderColor: '#000' },
    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999' },

    // --- STYLES MODALE ---
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    modalHeader: {
        width: '100%',
        height: 100, // Assez haut pour gérer l'encoche
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingRight: 20,
        paddingBottom: 10,
        backgroundColor: '#FFF',
        zIndex: 20,
    },
    closeModalBtn: {
        padding: 5,
    },
    modalFooter: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        marginTop: 10,
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    profilePlaceholder: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: '#CCC', // Gris placeholder
        justifyContent: 'center', alignItems: 'center',
    },
    userName: { fontWeight: '700', fontSize: 14 },
    drawingLabel: { color: '#666', fontSize: 12, marginTop: 2 },
    statsRow: {
        flexDirection: 'row',
        gap: 15,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    statText: { fontWeight: '600', fontSize: 16 },
});