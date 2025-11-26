import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Dimensions, Modal, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { useAuth } from '../src/contexts/AuthContext';
import { User, Mail, Lock, LogOut, X, Heart, AlertCircle } from 'lucide-react-native'; 
import { DrawingViewer } from '../src/components/DrawingViewer';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  
  const [historyItems, setHistoryItems] = useState<any[]>([]); // Nuages + Dessins
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [totalLikes, setTotalLikes] = useState(0);
  const [drawingCount, setDrawingCount] = useState(0);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const SPACING = 1;
  const ITEM_SIZE = (screenWidth - SPACING) / 2;

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Récupérer TOUS les nuages jusqu'à aujourd'hui (Ordre décroissant)
        const { data: clouds, error: cloudsError } = await supabase
            .from('clouds')
            .select('*')
            .lte('published_for', today) // Uniquement passé et présent
            .order('published_for', { ascending: false });

        if (cloudsError) throw cloudsError;

        // 2. Récupérer MES dessins
        const { data: myDrawings, error: drawingsError } = await supabase
            .from('drawings')
            .select('*')
            .eq('user_id', user?.id);

        if (drawingsError) throw drawingsError;

        // 3. Fusionner les deux (Algorithme du Calendrier)
        const history = clouds?.map(cloud => {
            // Est-ce que j'ai dessiné sur ce nuage ?
            const drawing = myDrawings?.find(d => d.cloud_id === cloud.id);
            return {
                type: drawing ? 'drawing' : 'missed', // On marque si c'est réussi ou raté
                id: cloud.id,
                date: cloud.published_for,
                cloud_image_url: cloud.image_url,
                // Si dessin, on prend ses infos, sinon null
                canvas_data: drawing ? drawing.canvas_data : [],
                likes_count: drawing ? drawing.likes_count : 0,
                label: drawing ? drawing.label : null,
                drawing_created_at: drawing ? drawing.created_at : null
            };
        });

        setHistoryItems(history || []);
        
        // Stats
        const drawingsOnly = myDrawings || [];
        setDrawingCount(drawingsOnly.length);
        setTotalLikes(drawingsOnly.reduce((acc, curr) => acc + (curr.likes_count || 0), 0));

    } catch (e) {
        console.error("Erreur profil:", e);
    } finally {
        setLoadingHistory(false);
    }
  };

  const handleEmailAuth = async () => {
    setFormLoading(true);
    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            Alert.alert("Vérifie tes emails !", "Lien envoyé.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            router.back();
        }
    } catch (e: any) { Alert.alert("Erreur", e.message); } finally { setFormLoading(false); }
  };

  const handleSignOut = async () => { await signOut(); router.replace('/'); };

  // --- RENDU D'UNE TUILE ---
  const renderItem = ({ item }: { item: any }) => {
      const isMissed = item.type === 'missed';
      
      return (
        <TouchableOpacity 
            activeOpacity={0.9}
            // On n'ouvre pas le popup si c'est raté (ou alors pour voir le nuage vide)
            onPress={() => !isMissed && setSelectedItem(item)} 
            style={{ 
                width: ITEM_SIZE, height: ITEM_SIZE, 
                marginBottom: SPACING, backgroundColor: '#F0F0F0', overflow: 'hidden',
                opacity: isMissed ? 0.6 : 1 // On grise un peu les jours ratés
            }}
        >
            <DrawingViewer
                imageUri={item.cloud_image_url}
                canvasData={item.canvas_data}
                viewerSize={ITEM_SIZE}
                transparentMode={false} 
                startVisible={true}
            />
            
            {/* Badge "RATÉ" si pas de dessin */}
            {isMissed && (
                <View style={styles.missedBadge}>
                    <AlertCircle color="#FFF" size={24} />
                    <Text style={styles.missedText}>{new Date(item.date).toLocaleDateString(undefined, {day:'numeric', month:'short'})}</Text>
                </View>
            )}
        </TouchableOpacity>
      );
  };

  const ProfileHeader = () => (
    <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
                <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}><User size={40} color="#666" /></View>
            )}
        </View>
        <Text style={styles.displayName}>{profile?.display_name || user?.email?.split('@')[0]}</Text>
        
        <View style={styles.statsRow}>
            <View style={styles.statItem}><Text style={styles.statNumber}>{drawingCount}</Text><Text style={styles.statLabel}>Dessins</Text></View>
            <View style={styles.statItem}><Text style={styles.statNumber}>{totalLikes}</Text><Text style={styles.statLabel}>J'aimes</Text></View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
            <LogOut size={16} color="#FFF" /><Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <Text style={styles.galleryTitle}>Mon historique</Text>
    </View>
  );

  if (authLoading) return <View style={styles.container}><ActivityIndicator color="#000"/></View>;

  return (
    <View style={styles.container}>
       <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}><X color="#000" size={28} /></TouchableOpacity>
            <Text style={styles.headerText}>{user ? "mon profil" : "connexion"}</Text>
       </View>

       {user ? (
            <FlatList
                data={historyItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={{ gap: SPACING }}
                ListHeaderComponent={ProfileHeader}
                contentContainerStyle={{ paddingBottom: 50 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}><Text style={styles.emptyText}>Aucune activité.</Text></View>
                }
            />
       ) : (
            <View style={styles.formContainer}>
                <Text style={styles.welcomeText}>Connecte-toi pour voir ton historique.</Text>
                <View style={styles.inputWrapper}><Mail size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} /></View>
                <View style={styles.inputWrapper}><Lock size={20} color="#999" style={styles.inputIcon}/><TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} /></View>
                <TouchableOpacity style={styles.authBtn} onPress={handleEmailAuth} disabled={formLoading}>
                    {formLoading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.authBtnText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}><Text style={styles.switchText}>{isSignUp ? "Déjà un compte ?" : "Pas de compte ?"}</Text></TouchableOpacity>
            </View>
       )}

       <Modal animationType="slide" transparent={false} visible={selectedItem !== null} onRequestClose={() => setSelectedItem(null)}>
            {selectedItem && (
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeModalBtn}><X color="#000" size={32} /></TouchableOpacity>
                    </View>
                    <Pressable onPressIn={() => setIsHolding(true)} onPressOut={() => setIsHolding(false)} style={{ width: screenWidth, height: screenWidth, backgroundColor: '#F0F0F0' }}>
                        <DrawingViewer
                            imageUri={selectedItem.cloud_image_url}
                            canvasData={isHolding ? [] : selectedItem.canvas_data}
                            viewerSize={screenWidth}
                            startVisible={false} animated={true}
                        />
                    </Pressable>
                    <View style={styles.modalFooter}>
                        <View><Text style={styles.drawingLabel}>{selectedItem.label}</Text><Text style={styles.dateText}>Le {new Date(selectedItem.drawing_created_at).toLocaleDateString()}</Text></View>
                        <View style={styles.statsRowSmall}><Heart color="#000" size={20} /><Text style={styles.statTextSmall}>{selectedItem.likes_count || 0}</Text></View>
                    </View>
                </View>
            )}
       </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  navHeader: { paddingTop: 60, paddingBottom: 15, alignItems: 'center', borderBottomWidth: 1, borderColor: '#F5F5F5', flexDirection: 'row', justifyContent: 'center' },
  headerText: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { position: 'absolute', left: 20, top: 60 },
  profileHeader: { alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
  avatarContainer: { marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 24, fontWeight: '900', marginBottom: 5 },
  statsRow: { flexDirection: 'row', gap: 40, marginBottom: 25 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#000', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30 },
  logoutText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  divider: { width: '100%', height: 1, backgroundColor: '#F0F0F0', marginTop: 30, marginBottom: 15 },
  galleryTitle: { fontSize: 16, fontWeight: '700', alignSelf: 'flex-start', paddingHorizontal: 20, marginBottom: 10 },
  formContainer: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', marginTop: -50 },
  welcomeText: { fontSize: 24, fontWeight: '800', marginBottom: 30, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%' },
  authBtn: { backgroundColor: '#000', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 20, color: '#666', fontSize: 14 },
  emptyState: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999' },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { width: '100%', height: 100, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, backgroundColor: '#FFF', zIndex: 20 },
  closeModalBtn: { padding: 5 },
  modalFooter: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10 },
  drawingLabel: { fontSize: 20, fontWeight: '800', color: '#000' },
  dateText: { fontSize: 14, color: '#999' },
  statsRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTextSmall: { fontWeight: '600', fontSize: 16 },
  
  // STYLE POUR LES JOURS RATÉS
  missedBadge: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center', alignItems: 'center',
  },
  missedText: {
      color: '#FFF', fontWeight: '700', marginTop: 5
  }
});