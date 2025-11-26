import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Keyboard, Modal, Image } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import { DrawingViewer } from '../../src/components/DrawingViewer';
import { useFocusEffect } from 'expo-router';
import { Search, Heart, Cloud, CloudOff, XCircle, X, MessageCircle, User } from 'lucide-react-native';

export default function GalleryPage() {
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
    useFocusEffect(useCallback(() => { fetchGallery(); }, []));

    const onRefresh = () => { setRefreshing(true); fetchGallery(); };
    const handleSearchSubmit = () => { setLoading(true); fetchGallery(); Keyboard.dismiss(); };
    const clearSearch = () => { setSearchText(''); setLoading(true); fetchGallery(''); Keyboard.dismiss(); };

    const openModal = (drawing: any) => setSelectedDrawing(drawing);
    const closeModal = () => setSelectedDrawing(null);

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => openModal(item)}
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
                startVisible={true} // Miniature : toujours visible direct
                animated={false}
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            
            {/* HEADER PRINCIPAL */}
            <View style={styles.headerBar}>
                <Text style={styles.headerText}>sunbim</Text>
            </View>

            {/* BARRE D'OUTILS */}
            <View style={styles.toolsContainer}>
                <View style={styles.searchBar}>
                    <Search color="#999" size={18} />
                    <TextInput 
                        placeholder="Rechercher..." placeholderTextColor="#999"
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

            {/* GRILLE */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000" /></View>
            ) : (
                <FlatList
                    data={drawings} renderItem={renderItem} keyExtractor={(item) => item.id}
                    numColumns={2} columnWrapperStyle={{ gap: SPACING }} contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000"/>}
                    ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>{searchText ? `Aucun résultat` : "Galerie vide."}</Text></View>}
                />
            )}

            {/* --- MODALE POP-UP --- */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={selectedDrawing !== null}
                onRequestClose={closeModal}
            >
                {selectedDrawing && (
                    <View style={styles.modalContainer}>
                        
                        {/* HEADER MODALE (Même style que l'accueil) */}
                        <View style={styles.headerBar}>
                            <Text style={styles.headerText}>sunbim</Text>
                            {/* Croix de fermeture */}
                            <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
                                <X color="#000" size={28} />
                            </TouchableOpacity>
                        </View>

                        {/* Image en grand */}
                        <View style={{ width: screenWidth, height: screenWidth, backgroundColor: '#F0F0F0' }}>
                            <DrawingViewer
                                imageUri={selectedDrawing.cloud_image_url}
                                canvasData={selectedDrawing.canvas_data}
                                viewerSize={screenWidth}
                                transparentMode={!showClouds}
                                // --- ANIMATION ACTIVÉE ---
                                startVisible={false} // On part de zéro
                                animated={true}      // On lance le tracé
                            />
                        </View>

                        {/* Infos */}
                        <View style={styles.modalFooter}>
                            <View style={styles.userInfoRow}>
                                <View style={styles.profilePlaceholder}><User color="#FFF" size={20} /></View>
                                <View>
                                    <Text style={styles.userName}>Anonyme</Text>
                                    {selectedDrawing.label && <Text style={styles.drawingLabel}>{selectedDrawing.label}</Text>}
                                </View>
                            </View>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}><Heart color="#000" size={24} /><Text style={styles.statText}>0</Text></View>
                                <View style={styles.statItem}><MessageCircle color="#000" size={24} /><Text style={styles.statText}>0</Text></View>
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
    
    // HEADER (Utilisé en haut et dans la modale)
    headerBar: { 
        width: '100%', 
        backgroundColor: '#FFFFFF', 
        paddingTop: 60, 
        paddingBottom: 15, 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 10,
        // Petit trait de séparation
        borderBottomWidth: 1,
        borderBottomColor: '#F9F9F9'
    },
    headerText: { 
        fontSize: 32, 
        fontWeight: '900', 
        color: '#FFFFFF', 
        textShadowColor: 'rgba(0, 0, 0, 0.5)', 
        textShadowOffset: { width: 2, height: 2 }, 
        textShadowRadius: 0, 
        letterSpacing: -1 
    },
    closeBtn: {
        position: 'absolute',
        right: 20,
        bottom: 15, // Aligné verticalement avec le texte
    },

    // TOOLS
    toolsContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 15, paddingTop: 10, alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#000', height: '100%' },
    actionsRow: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
    activeBtn: { backgroundColor: '#000', borderColor: '#000' },
    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999' },

    // MODALE
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center' },
    userName: { fontWeight: '700', fontSize: 14 },
    drawingLabel: { color: '#666', fontSize: 12, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 15 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statText: { fontWeight: '600', fontSize: 16 },
});