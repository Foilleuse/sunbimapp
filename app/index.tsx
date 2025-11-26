import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';

interface Cloud {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  published_for: string;
}

export default function DrawPage() {
  const router = useRouter(); 
  
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Outils Dessin
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  // --- NOUVEAU : Gestion du Tag ---
  const [modalVisible, setModalVisible] = useState(false);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false); // Pour éviter le double clic
  
  const canvasRef = useRef<DrawingCanvasRef>(null);

  // Info Version (Debug)
  const updateLabel = Updates.updateId ? `v.${Updates.updateId.substring(0, 6)}` : 'Dev';

  useEffect(() => {
    fetchTodaysCloud();
  }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) throw new Error('Supabase not init');

      const today = new Date().toISOString().split('T')[0];
      const { data, error: fetchError } = await supabase
        .from('clouds')
        .select('*')
        .eq('published_for', today)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setCloud(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  // ÉTAPE 1 : Clic sur le bouton Share -> Ouvre la Modale
  const handleSharePress = () => {
    if (!canvasRef.current) return;
    const paths = canvasRef.current.getPaths();
    
    if (!paths || paths.length === 0) {
        Alert.alert("Oups", "Dessine quelque chose avant de partager !");
        return;
    }
    // Ouvre la fenêtre de tag
    setModalVisible(true);
  };

  // ÉTAPE 2 : Validation finale -> Envoi Supabase
  const confirmShare = async () => {
    if (!canvasRef.current) return;
    if (tagText.trim().length === 0) {
        Alert.alert("Tag requis", "Dis-nous ce que tu as vu ! (ex: Dragon, Lapin...)");
        return;
    }

    setIsUploading(true);
    
    try {
        const pathsData = canvasRef.current.getPaths();
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error: dbError } = await supabase
            .from('drawings')
            .insert({
                cloud_id: cloud?.id,
                user_id: user?.id, 
                canvas_data: pathsData,
                cloud_image_url: cloud?.image_url,
                label: tagText.trim(), // <--- ON SAUVEGARDE LE TAG ICI
                is_shared: true
            });

        if (dbError) throw dbError;

        // Succès !
        setModalVisible(false);
        setTagText(''); // Reset
        router.push('/(tabs)/feed');
        
    } catch (e: any) {
        Alert.alert("Erreur", "Echec de la sauvegarde: " + e.message);
    } finally {
        setIsUploading(false);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#87CEEB" style={{marginTop:100}} /></View>;
  if (error) return <View style={styles.container}><Text style={styles.errorText}>Error: {error}</Text></View>;
  if (!cloud) return <View style={styles.container}><Text style={styles.noCloudText}>No cloud today</Text></View>;

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <Text style={styles.headerText}>sunbim</Text>
        <Text style={styles.versionText}>{updateLabel}</Text>
      </View>

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
      
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={{flex: 1}} pointerEvents="none" /> 
        <DrawingControls
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            strokeColor={strokeColor}
            onColorChange={setStrokeColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            isEraserMode={isEraserMode}
            toggleEraser={toggleEraser}
            onShare={handleSharePress} // <--- On appelle l'ouverture de modale
         />
      </View>

      {/* --- MODALE DE TAG --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
        >
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Qu'as-tu vu ?</Text>
                <Text style={styles.modalSubtitle}>Donne un titre à ton œuvre</Text>
                
                <TextInput 
                    style={styles.input}
                    placeholder="Ex: Un dragon qui dort..."
                    placeholderTextColor="#999"
                    value={tagText}
                    onChangeText={setTagText}
                    autoFocus={true}
                    maxLength={30}
                />

                <TouchableOpacity 
                    style={[styles.validateBtn, isUploading && styles.disabledBtn]} 
                    onPress={confirmShare}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.validateText}>Publier</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={() => setModalVisible(false)}
                    disabled={isUploading}
                >
                    <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 60, paddingBottom: 15, alignItems: 'center', zIndex: 10, pointerEvents: 'none',
  },
  headerText: {
    fontSize: 32, fontWeight: '900', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },
  versionText: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1,
  },
  errorText: { fontSize: 16, color: 'red', textAlign: 'center' },
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center' },

  // --- STYLES MODALE ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)', // Fond sombre
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10
  },
  modalTitle: {
    fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5
  },
  modalSubtitle: {
    fontSize: 14, color: '#666', marginBottom: 20
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#F9F9F9'
  },
  validateBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#000',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  disabledBtn: {
    opacity: 0.7
  },
  validateText: {
    color: '#FFF', fontWeight: '700', fontSize: 16
  },
  cancelBtn: {
    padding: 10,
  },
  cancelText: {
    color: '#999', fontWeight: '600'
  }
});