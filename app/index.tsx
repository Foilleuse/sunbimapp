import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingViewer } from '../src/components/DrawingViewer'; // Le lecteur pour l'animation
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { SunbimHeader } from '../src/components/SunbimHeader';

interface Cloud {
  id: string;
  image_url: string;
}

export default function DrawPage() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  const { width: screenWidth } = Dimensions.get('window');
  
  // Etats Données
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Etats Outils
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  // Etats UI
  const [modalVisible, setModalVisible] = useState(false);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Etats Animation Cinématique
  const [replayPaths, setReplayPaths] = useState<any[] | null>(null);
  const fadeWhiteAnim = useRef(new Animated.Value(0)).current; // Opacité du fond blanc
  const drawingOpacityAnim = useRef(new Animated.Value(1)).current; // Opacité du dessin (pour le faire disparaitre à la fin)

  const canvasRef = useRef<DrawingCanvasRef>(null);

  useEffect(() => { fetchTodaysCloud(); }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
      if (error) throw error;
      setCloud(data);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  const handleSharePress = () => {
    if (!canvasRef.current) return;
    const paths = canvasRef.current.getPaths();
    if (!paths || paths.length === 0) { Alert.alert("Oups", "Dessine d'abord !"); return; }
    if (!user) { Alert.alert("Connexion", "Connecte-toi pour partager.", [{ text: "Go", onPress: () => router.push('/profile') }, { text: "Annuler" }]); return; }
    setModalVisible(true);
  };

  // --- LA SÉQUENCE MAGIQUE ---
  const confirmShare = async () => {
    if (!canvasRef.current || !cloud || !user) return;
    if (tagText.trim().length === 0) return;

    setIsUploading(true);
    
    try {
        const pathsData = canvasRef.current.getPaths();
        
        // 1. Upload Supabase
        const { error: dbError } = await supabase.from('drawings').insert({
            cloud_id: cloud.id, user_id: user.id, canvas_data: pathsData, cloud_image_url: cloud.image_url,
            label: tagText.trim(), is_shared: true
        });
        if (dbError) throw dbError;

        // 2. Succès -> On ferme le clavier et la modale
        setModalVisible(false);
        setTagText('');
        
        // 3. ÉTAPE 1 : FONDU AU BLANC (Montée au ciel)
        Animated.timing(fadeWhiteAnim, {
            toValue: 1, // L'écran devient tout blanc
            duration: 800,
            useNativeDriver: true,
        }).start(() => {
            
            // 4. ÉTAPE 2 : L'écran est blanc, on lance le REPLAY
            setReplayPaths(pathsData); // Affiche le viewer
            
            // Le viewer met 1500ms à se dessiner (réglé dans DrawingViewer.tsx)
            // On attend la fin du dessin + une petite pause de contemplation
            setTimeout(() => {
                
                // 5. ÉTAPE 3 : LE DESSIN DISPARAÎT (Fondu vers le blanc pur)
                Animated.timing(drawingOpacityAnim, {
                    toValue: 0, // Le dessin s'efface
                    duration: 800,
                    useNativeDriver: true
                }).start(() => {
                    
                    // 6. ÉTAPE 4 : NAVIGATION (Invisible)
                    // On va sur le Feed. Le Feed commence aussi par un écran blanc qui s'ouvre.
                    // La transition sera imperceptible.
                    router.replace('/(tabs)/feed');
                    
                    // Reset pour le retour futur
                    setTimeout(() => {
                        fadeWhiteAnim.setValue(0);
                        drawingOpacityAnim.setValue(1);
                        setReplayPaths(null);
                        handleClear();
                        setIsUploading(false);
                    }, 1000);
                });

            }, 2000); // 1.5s anim + 0.5s pause
        });
        
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
        setIsUploading(false);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#87CEEB" /></View>;
  if (!cloud) return <View style={styles.container}><Text style={styles.noCloudText}>Pas de nuage aujourd'hui.</Text></View>;

  return (
    <View style={styles.container}>
      
      {/* HEADER FLOTTANT */}
      <View style={styles.header}><Text style={styles.headerText}>sunbim</Text></View>

      {/* CANVAS DESSIN */}
      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          imageUri={cloud.image_url}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          isEraserMode={isEraserMode}
          onClear={handleClear}
        />
      </View>
      
      {/* CONTROLS */}
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

      {/* MODALE TAG */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Qu'as-tu vu ?</Text>
                <TextInput style={styles.input} placeholder="Ex: Un dragon..." value={tagText} onChangeText={setTagText} autoFocus={true} maxLength={30} onSubmitEditing={confirmShare}/>
                <TouchableOpacity style={styles.validateBtn} onPress={confirmShare} disabled={isUploading}>
                    {isUploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.validateText}>Publier</Text>}
                </TouchableOpacity>
                {!isUploading && <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>}
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- LE VOILE CINÉMATIQUE --- */}
      <Animated.View 
        pointerEvents="none" // Important : laisse passer les clics tant qu'il est invisible
        style={[
            StyleSheet.absoluteFill, 
            { 
                backgroundColor: 'white', 
                opacity: fadeWhiteAnim, 
                zIndex: 9999, // Tout en haut
                justifyContent: 'center',
                alignItems: 'center'
            }
        ]} 
      >
          {/* LE REPLAY SUR FOND BLANC */}
          {replayPaths && (
              <Animated.View style={{ opacity: drawingOpacityAnim, width: screenWidth, height: screenWidth }}>
                  <DrawingViewer 
                      imageUri={cloud.image_url} // On a besoin de l'image pour l'échelle
                      canvasData={replayPaths}
                      viewerSize={screenWidth}
                      transparentMode={true} // <--- FOND TRANSPARENT (donc Blanc car posé sur le voile blanc)
                      animated={true} // <--- ACTION !
                      startVisible={false}
                  />
              </Animated.View>
          )}
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, paddingBottom: 15, alignItems: 'center', zIndex: 10, pointerEvents: 'none' },
  headerText: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center', marginTop: 100 },
  errorText: { color: 'red', textAlign: 'center' },

  // Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#F9F9F9' },
  validateBtn: { width: '100%', height: 50, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  validateText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#999', fontWeight: '600' }
});