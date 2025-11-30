import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';
import { SunbimHeader } from '../src/components/SunbimHeader';
import { useAuth } from '../src/contexts/AuthContext';

const FALLBACK_CLOUD = {
    id: 'fallback',
    image_url: 'https://images.unsplash.com/photo-1506053420909-e828c43512bb?q=80&w=1000&auto=format&fit=crop'
};

export default function DrawPage() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  const canvasRef = useRef<DrawingCanvasRef>(null);
  
  const [cloud, setCloud] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Outils
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);

  // Modales
  const [showShareModal, setShowShareModal] = useState(false);
  const [drawingTitle, setDrawingTitle] = useState('');
  const [sending, setSending] = useState(false);

  // Auth locale
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    fetchDailyCloud();
  }, []);

  // Gestion de la connexion SANS navigation vers Profil
  useEffect(() => {
    if (user) {
        // 1. On ferme la modale de connexion si elle est ouverte
        setShowAuthModal(false); 
        // 2. On vérifie juste si on doit aller au Feed (si déjà joué)
        checkIfPlayedToday();
    }
  }, [user]);

  const fetchDailyCloud = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('clouds')
            .select('*')
            .eq('published_for', today)
            .maybeSingle();
        
        if (data) setCloud(data);
        else setCloud(FALLBACK_CLOUD);
    } catch (e) {
        setCloud(FALLBACK_CLOUD);
    } finally {
        setLoading(false);
    }
  };

  const checkIfPlayedToday = async () => {
    if (!user || !cloud) return;
    try {
        const { data } = await supabase
            .from('drawings')
            .select('id')
            .eq('user_id', user.id)
            .eq('cloud_id', cloud.id)
            .maybeSingle();

        if (data) {
            router.replace('/(tabs)/feed');
        }
    } catch (e) { console.error(e); }
  };

  const handleAuthAction = async () => {
    if (!email || !password) return Alert.alert("Erreur", "Veuillez remplir tous les champs");
    setAuthLoading(true);
    try {
        const { error } = isSignUp 
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Succès : le useEffect détectera 'user' et fermera la modale sans rediriger
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
    } finally {
        setAuthLoading(false);
    }
  };

  const handleSharePress = () => {
      if (!user) setShowAuthModal(true);
      else setShowShareModal(true);
  };

  const submitDrawing = async () => {
      if (!drawingTitle.trim()) return Alert.alert("Titre manquant", "Qu'avez-vous vu ?");
      if (!canvasRef.current || !cloud || !user) return;

      setSending(true);
      try {
          const paths = canvasRef.current.getPaths();
          const { error } = await supabase.from('drawings').insert({
              user_id: user.id,
              cloud_id: cloud.id,
              cloud_image_url: cloud.image_url,
              canvas_data: paths,
              label: drawingTitle,
              image_url: ""
          });

          if (error) throw error;
          router.replace('/(tabs)/feed');
      } catch (e: any) {
          Alert.alert("Erreur", e.message);
      } finally {
          setSending(false);
      }
  };

  if (loading || !cloud) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000"/></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.absoluteHeader}>
         {/* CORRECTION CRITIQUE : showProfileButton={false} supprime tout accès au profil */}
         <SunbimHeader showCloseButton={false} showProfileButton={false} />
      </View>

      <DrawingCanvas 
        ref={canvasRef}
        imageUri={cloud.image_url}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        isEraserMode={isEraserMode}
      />

      <DrawingControls 
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        isEraserMode={isEraserMode}
        toggleEraser={() => setIsEraserMode(!isEraserMode)}
        onShare={handleSharePress}
      />

      {/* --- MODALES --- */}
      
      <Modal visible={showShareModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Bien vu !</Text>
                  <Text style={styles.modalSubtitle}>Donnez un titre à votre œuvre</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Un lapin géant..." 
                    placeholderTextColor="#999"
                    value={drawingTitle}
                    onChangeText={setDrawingTitle}
                    autoFocus
                  />
                  <View style={styles.modalButtons}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowShareModal(false)}>
                          <Text style={styles.cancelText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmBtn} onPress={submitDrawing} disabled={sending}>
                          {sending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Publier</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAuthModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{isSignUp ? "Créer un compte" : "Se connecter"}</Text>
                  <Text style={styles.modalSubtitle}>Pour sauvegarder votre dessin</Text>
                  
                  <TextInput 
                    style={styles.input} placeholder="Email" placeholderTextColor="#999"
                    value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                  />
                  <TextInput 
                    style={styles.input} placeholder="Mot de passe" placeholderTextColor="#999"
                    value={password} onChangeText={setPassword} secureTextEntry
                  />

                  <TouchableOpacity style={styles.confirmBtn} onPress={handleAuthAction} disabled={authLoading}>
                      {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{marginTop: 15}}>
                      <Text style={styles.switchText}>{isSignUp ? "J'ai déjà un compte" : "Créer un compte"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.closeModal} onPress={() => setShowAuthModal(false)}>
                      <Text style={styles.cancelText}>Fermer</Text>
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  absoluteHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 12, backgroundColor: '#FAFAFA' },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
  cancelBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#F0F0F0' },
  confirmBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#000', width: '100%' },
  cancelText: { color: '#000', fontWeight: '600', fontSize: 16 },
  confirmText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  switchText: { color: '#666', fontSize: 14, textDecorationLine: 'underline' },
  closeModal: { marginTop: 20 }
});