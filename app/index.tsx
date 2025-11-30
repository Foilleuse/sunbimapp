import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates'; // Pour gérer les mises à jour si besoin
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingControls } from '../src/components/DrawingControls';
import { SunbimHeader } from '../src/components/SunbimHeader';
import { useAuth } from '../src/contexts/AuthContext';

// Placeholder si pas de nuage
const FALLBACK_CLOUD = {
    id: 'fallback',
    image_url: 'https://images.unsplash.com/photo-1506053420909-e828c43512bb?q=80&w=1000&auto=format&fit=crop'
};

export default function DrawPage() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  const canvasRef = useRef<DrawingCanvasRef>(null);
  
  // --- ETATS ---
  const [cloud, setCloud] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Outils de dessin
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);

  // Modale de Partage
  const [showShareModal, setShowShareModal] = useState(false);
  const [drawingTitle, setDrawingTitle] = useState('');
  const [sending, setSending] = useState(false);

  // Modale d'Auth (Login/Signup)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // 1. Chargement initial
  useEffect(() => {
    fetchDailyCloud();
  }, []);

  // 2. Vérification : Si l'utilisateur est connecté, a-t-il déjà joué ?
  // CORRECTION ICI : On ne redirige JAMAIS vers le profil. Seulement vers le Feed si déjà joué.
  useEffect(() => {
    if (user) {
        checkIfPlayedToday();
        // On ferme la modale de connexion si elle est ouverte, car l'user est là.
        setShowAuthModal(false); 
    }
  }, [user]);

  const fetchDailyCloud = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('clouds')
            .select('*')
            .eq('published_for', today)
            .maybeSingle(); // maybeSingle évite l'erreur si vide
        
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
            // Déjà joué -> On va voir les autres (Feed)
            router.replace('/(tabs)/feed');
        }
        // Sinon -> On reste ici pour dessiner !
    } catch (e) {
        console.error(e);
    }
  };

  // --- LOGIQUE AUTHENTIFICATION ---
  const handleAuthAction = async () => {
    if (!email || !password) return Alert.alert("Erreur", "Veuillez remplir tous les champs");
    
    setAuthLoading(true);
    try {
        const { error } = isSignUp 
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });

        if (error) throw error;

        // Succès : On ne fait rien de spécial, le useEffect([user]) va détecter la connexion
        // et fermer la modale automatiquement.
        
    } catch (e: any) {
        Alert.alert("Erreur", e.message);
    } finally {
        setAuthLoading(false);
    }
  };

  // --- LOGIQUE DESSIN ---
  const handleSharePress = () => {
      if (!user) {
          // Pas connecté ? On ouvre la modale de connexion locale
          setShowAuthModal(true);
      } else {
          // Connecté ? On ouvre la modale de titre
          setShowShareModal(true);
      }
  };

  const submitDrawing = async () => {
      if (!drawingTitle.trim()) return Alert.alert("Titre manquant", "Qu'avez-vous vu dans ce nuage ?");
      if (!canvasRef.current || !cloud || !user) return;

      setSending(true);
      try {
          const paths = canvasRef.current.getPaths(); // Récupère les données vectorielles (V19 Fix)
          
          const { error } = await supabase.from('drawings').insert({
              user_id: user.id,
              cloud_id: cloud.id,
              cloud_image_url: cloud.image_url,
              canvas_data: paths, // Stockage JSON direct
              label: drawingTitle,
              image_url: "" // Plus besoin de base64 lourd
          });

          if (error) throw error;

          // Succès -> Feed
          router.replace('/(tabs)/feed');

      } catch (e: any) {
          Alert.alert("Erreur d'envoi", e.message);
      } finally {
          setSending(false);
      }
  };

  if (loading || !cloud) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#000"/></View>;
  }

  return (
    <View style={styles.container}>
      {/* HEADER FIXE */}
      <View style={styles.absoluteHeader}>
         <SunbimHeader showCloseButton={false} showProfileButton={true} />
      </View>

      {/* CANVAS DE DESSIN */}
      <DrawingCanvas 
        ref={canvasRef}
        imageUri={cloud.image_url}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        isEraserMode={isEraserMode}
      />

      {/* CONTROLS */}
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

      {/* MODALE : TITRE DU DESSIN (Avant envoi) */}
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

      {/* MODALE : AUTHENTIFICATION (Login/Signup) */}
      {/* Cette modale permet de se connecter SANS quitter la page */}
      <Modal visible={showAuthModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{isSignUp ? "Créer un compte" : "Se connecter"}</Text>
                  <Text style={styles.modalSubtitle}>Pour sauvegarder votre dessin</Text>
                  
                  <TextInput 
                    style={styles.input} 
                    placeholder="Email" 
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Mot de passe" 
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
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
  
  // Styles Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 12, backgroundColor: '#FAFAFA' },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
  cancelBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#F0F0F0' },
  confirmBtn: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#000', width: '100%' }, // width 100% pour la modale auth
  cancelText: { color: '#000', fontWeight: '600', fontSize: 16 },
  confirmText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  switchText: { color: '#666', fontSize: 14, textDecorationLine: 'underline' },
  closeModal: { marginTop: 20 }
});