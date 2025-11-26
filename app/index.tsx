import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
// On importe le lecteur pour faire le replay
import { DrawingViewer } from '../src/components/DrawingViewer';
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

interface Cloud {
  id: string;
  image_url: string;
}

export default function DrawPage() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  
  const { width: screenWidth } = Dimensions.get('window');

  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  // Etats Tag & Upload
  const [modalVisible, setModalVisible] = useState(false);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // --- NOUVEAU : ÉTAT POUR LE REPLAY ---
  // Si ce tableau n'est pas null, on est en mode "Replay"
  const [replayPaths, setReplayPaths] = useState<any[] | null>(null);

  const canvasRef = useRef<DrawingCanvasRef>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current; 

  useEffect(() => {
    fetchTodaysCloud();
  }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) throw new Error('Supabase not init');
      const today = new Date().toISOString().split('T')[0];
      const { data, error: fetchError } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
      if (fetchError) throw fetchError;
      setCloud(data);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  const handleSharePress = () => {
    if (!canvasRef.current) return;
    const paths = canvasRef.current.getPaths();
    if (!paths || paths.length === 0) {
        Alert.alert("Oups", "Dessine quelque chose avant de partager !");
        return;
    }
    if (!user) {
        Alert.alert("Connexion requise", "Connecte-toi pour participer.", [
            { text: "Annuler", style: "cancel" },
            { text: "Se connecter", onPress: () => router.push('/profile') }
        ]);
        return;
    }
    setModalVisible(true);
  };

  // --- SÉQUENCE MAGIQUE ---
  const confirmShare = async () => {
    if (!canvasRef.current || !cloud || !user) return;
    
    if (tagText.trim().length === 0) {
        Alert.alert("Tag manquant", "Dis-nous ce que tu as vu !");
        return;
    }

    setIsUploading(true);
    
    try {
        // 1. On récupère les données
        const pathsData = canvasRef.current.getPaths();
        
        // 2. On Upload
        const { error: dbError } = await supabase
            .from('drawings')
            .insert({
                cloud_id: cloud.id,
                user_id: user.id, 
                canvas_data: pathsData,
                cloud_image_url: cloud.image_url,
                label: tagText.trim(),
                is_shared: true
            });

        if (dbError) throw dbError;

        // 3. SUCCÈS : On lance le spectacle
        setModalVisible(false);
        setTagText('');
        
        // A. On active le mode Replay (Cela remplace le Canvas par le Viewer Animé)
        setReplayPaths(pathsData);

        // B. On attend la fin du tracé (1.5s d'animation + 0.5s de pause pour admirer)
        setTimeout(() => {
            // C. On lance le Fondu Blanc
            Animated.timing(fadeAnim, {
                toValue: 1, 
                duration: 1000, 
                useNativeDriver: true,
            }).start(() => {
                // D. Navigation vers le Feed
                router.replace('/(tabs)/feed');
                
                // Reset pour le retour
                setTimeout(() => {
                    fadeAnim.setValue(0);
                    setReplayPaths(null);
                    handleClear();
                }, 1000);
            });
        }, 2000); // 1500ms (anim) + 500ms (pause)
        
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
        setIsUploading(false); // On arrête le loading seulement si erreur
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#87CEEB" style={{marginTop:100}} /></View>;
  if (error) return <View style={styles.container}><Text style={styles.errorText}>Error: {error}</Text></View>;
  if (!cloud) return <View style={styles.container}><Text style={styles.noCloudText}>No cloud today</Text></View>;

  return (
    <View style={styles.container}>
      
      {/* HEADER (Disparait pendant le fondu blanc grâce au zIndex du voile) */}
      <View style={styles.header}>
        <Text style={styles.headerText}>sunbim</Text>
      </View>

      <View style={styles.canvasContainer}>
        {/* ICI C'EST L'ASTUCE : 
            Si replayPaths existe, on affiche le Viewer (Lecture seule animée).
            Sinon, on affiche le Canvas (Outil de dessin).
            Ils sont superposés exactement au même endroit.
        */}
        {replayPaths ? (
            <DrawingViewer 
                imageUri={cloud.image_url}
                canvasData={replayPaths}
                viewerSize={screenWidth} // Pleine largeur comme l'éditeur
                transparentMode={false} // On garde le fond nuage
                animated={true} // On lance l'animation !
                startVisible={false} // On part de zéro
            />
        ) : (
            <DrawingCanvas
              ref={canvasRef}
              imageUri={cloud.image_url}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              isEraserMode={isEraserMode}
              onClear={handleClear}
            />
        )}
      </View>
      
      {/* Les contrôles disparaissent pendant le replay pour laisser la vue pure */}
      {!replayPaths && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={{flex: 1}} pointerEvents="none" /> 
            <DrawingControls
                onUndo={handleUndo} onRedo={handleRedo} onClear={handleClear}
                strokeColor={strokeColor} onColorChange={setStrokeColor}
                strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
                isEraserMode={isEraserMode} toggleEraser={toggleEraser}
                onShare={handleSharePress}
             />
          </View>
      )}

      {/* MODALE TAG */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => isUploading ? null : setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Qu'as-tu vu ?</Text>
                <Text style={styles.modalSubtitle}>Donne un titre à ton œuvre</Text>
                <TextInput 
                    style={styles.input} placeholder="Ex: Un dragon qui dort..." placeholderTextColor="#999"
                    value={tagText} onChangeText={setTagText} autoFocus={true} maxLength={30} returnKeyType="done" onSubmitEditing={confirmShare}
                />
                <TouchableOpacity style={[styles.validateBtn, isUploading && styles.disabledBtn]} onPress={confirmShare} disabled={isUploading}>
                    {isUploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.validateText}>Publier</Text>}
                </TouchableOpacity>
                {!isUploading && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                        <Text style={styles.cancelText}>Annuler</Text>
                    </TouchableOpacity>
                )}
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* VOILE BLANC */}
      <Animated.View 
        pointerEvents="none"
        style={[
            StyleSheet.absoluteFill, 
            { backgroundColor: 'white', opacity: fadeAnim, zIndex: 9999 }
        ]} 
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: 'red', textAlign: 'center' },
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center', marginTop: 100 },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 60, paddingBottom: 15,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, pointerEvents: 'none',
  },
  headerText: {
    fontSize: 32, fontWeight: '900', color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
    letterSpacing: -1,
  },

  // MODALE
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#F9F9F9' },
  validateBtn: { width: '100%', height: 50, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  disabledBtn: { opacity: 0.7 },
  validateText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#999', fontWeight: '600' }
});