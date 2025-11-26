import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';
import { SunbimHeader } from '../src/components/SunbimHeader';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext'; // <--- IMPORTANT

interface Cloud {
  id: string;
  image_url: string;
}

export default function DrawPage() {
  const router = useRouter(); 
  const { user } = useAuth(); // On récupère l'utilisateur connecté
  
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Outils Dessin
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  // --- ETATS POUR LE TAG & UPLOAD ---
  const [modalVisible, setModalVisible] = useState(false);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const canvasRef = useRef<DrawingCanvasRef>(null);

  useEffect(() => {
    fetchTodaysCloud();
  }, []);

  const fetchTodaysCloud = async () => {
    try {
      setLoading(true);
      if (!supabase) throw new Error('Supabase not init');
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
      if (error) throw error;
      setCloud(data);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  // --- 1. PREMIER CLIC : VÉRIFICATION ---
  const handleSharePress = () => {
    if (!canvasRef.current) return;
    
    // A. Vérifier si le dessin existe
    const paths = canvasRef.current.getPaths();
    if (!paths || paths.length === 0) {
        Alert.alert("Oups", "Dessine quelque chose avant de partager !");
        return;
    }

    // B. VÉRIFICATION CONNEXION
    if (!user) {
        Alert.alert(
            "Connexion requise",
            "Tu dois avoir un compte pour ajouter ton nuage à la galerie.",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Se connecter / S'inscrire", 
                    onPress: () => router.push('/profile') // Envoie vers la page profil
                }
            ]
        );
        return;
    }

    // C. Si connecté : Ouvre le formulaire de Tag
    setModalVisible(true);
  };

  // --- 2. VALIDATION FINALE (UPLOAD) ---
  const confirmShare = async () => {
    if (!canvasRef.current || !cloud || !user) return;
    
    if (tagText.trim().length === 0) {
        Alert.alert("Tag manquant", "Dis-nous ce que tu as vu ! (ex: Dragon, Lapin...)");
        return;
    }

    setIsUploading(true);
    
    try {
        const pathsData = canvasRef.current.getPaths();
        
        const { error: dbError } = await supabase
            .from('drawings')
            .insert({
                cloud_id: cloud.id,
                user_id: user.id, // On est sûrs qu'il existe ici
                canvas_data: pathsData,
                cloud_image_url: cloud.image_url,
                label: tagText.trim(), // On sauvegarde le tag
                is_shared: true
            });

        if (dbError) throw dbError;

        // Reset et Redirection
        setModalVisible(false);
        setTagText('');
        Alert.alert("Succès !", "Ton œuvre est dans les nuages ☁️");
        router.push('/(tabs)/feed');
        
    } catch (e: any) {
        Alert.alert("Erreur", "Echec de l'envoi: " + e.message);
    } finally {
        setIsUploading(false);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#87CEEB" style={{marginTop:100}} /></View>;
  if (error) return <View style={styles.container}><Text style={styles.errorText}>Error: {error}</Text></View>;
  if (!cloud) return <View style={styles.container}><Text style={styles.noCloudText}>No cloud today</Text></View>;

  return (
    <View style={styles.container}>
      
      {/* HEADER (Avec bouton profil pour se connecter si besoin) */}
      <SunbimHeader showCloseButton={false} showProfileButton={true} />

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
            onUndo={handleUndo} onRedo={handleRedo} onClear={handleClear}
            strokeColor={strokeColor} onColorChange={setStrokeColor}
            strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
            isEraserMode={isEraserMode} toggleEraser={toggleEraser}
            onShare={handleSharePress} // <--- Déclenche le process
         />
      </View>

      {/* --- MODALE DE TAG (Réintégrée) --- */}
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
                    returnKeyType="done"
                    onSubmitEditing={confirmShare}
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
  errorText: { fontSize: 16, color: 'red', textAlign: 'center' },
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center' },

  // Styles Modale Tag
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: {
    width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12,
    paddingHorizontal: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#F9F9F9'
  },
  validateBtn: {
    width: '100%', height: 50, backgroundColor: '#000', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10
  },
  disabledBtn: { opacity: 0.7 },
  validateText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#999', fontWeight: '600' }
});