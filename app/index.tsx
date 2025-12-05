import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Dimensions, AppState } from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingViewer } from '../src/components/DrawingViewer'; 
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import * as Updates from 'expo-updates';
import React from 'react';

interface Cloud {
  id: string;
  image_url: string;
}

const FALLBACK_CLOUD = {
    id: 'fallback',
    image_url: 'https://images.unsplash.com/photo-1506053420909-e828c43512bb?q=80&w=1000&auto=format&fit=crop'
};

export default function DrawPage() {
  const router = useRouter(); 
  const { user } = useAuth(); 
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  
  // --- SPLASH SCREEN INTERNE ---
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current; 
  
  const [strokeColor, setStrokeColor] = useState('#000000');
  // MODIFICATION ICI : Épaisseur initiale réglée sur 2 (la plus fine)
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  const [replayPaths, setReplayPaths] = useState<any[] | null>(null);
  
  const fadeWhiteAnim = useRef(new Animated.Value(0)).current; 
  const drawingOpacityAnim = useRef(new Animated.Value(1)).current; 
  const textOpacityAnim = useRef(new Animated.Value(0)).current; 

  const canvasRef = useRef<DrawingCanvasRef>(null);
  const updateLabel = (Updates && Updates.updateId) ? `v.${Updates.updateId.substring(0, 6)}` : '';

  // --- ANIMATION D'OUVERTURE (SPLASH) ---
  useEffect(() => {
    const timer = setTimeout(() => {
        Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 500, // Durée ajustée à 0.5s
            useNativeDriver: true,
        }).start(() => {
            setShowSplash(false); 
        });
    }, 2000); // Reste affiché 2s avant de fondre

    return () => clearTimeout(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
        checkStatusAndLoad();
    }, [user])
  );

  useEffect(() => {
      const subscription = AppState.addEventListener('change', nextAppState => {
          if (nextAppState === 'active') {
              checkStatusAndLoad();
          }
      });
      return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (user) {
        setAuthModalVisible(false); 
    }
  }, [user]);

  const checkStatusAndLoad = async () => {
    // CORRECTION : On ne met loading=true QUE si on n'a pas encore de nuage.
    // Si le nuage est déjà affiché (et qu'on a dessiné dessus), on ne veut pas 
    // afficher le spinner qui démonterait le composant Canvas et effacerait le dessin.
    if (!cloud) {
        setLoading(true); 
    }
    
    try {
        if (!supabase) throw new Error("No Supabase");
        const today = new Date().toISOString().split('T')[0];
        
        const { data: cloudData, error: cloudError } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();   
        if (cloudError) throw cloudError;
        const currentCloud = cloudData || FALLBACK_CLOUD;
        setCloud(currentCloud);
        
        if (user && cloudData) {
            const { data: existingDrawing } = await supabase
                .from('drawings')
                .select('id')
                .eq('user_id', user.id)
                .eq('cloud_id', cloudData.id) 
                .maybeSingle();

            if (existingDrawing) {
                console.log("🚫 Déjà joué aujourd'hui -> Redirection Feed");
                router.replace('/(tabs)/feed'); 
                return; 
            }
        }
    } catch (err) {
        console.error(err);
        setCloud(FALLBACK_CLOUD);
    } finally {
        setLoading(false);
    }
  };

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  const handleSharePress = () => {
    if (!canvasRef.current) return;
    
    // Si l'utilisateur n'est PAS connecté
    if (!user) { 
        // Vérification si l'utilisateur a dessiné quelque chose
        const paths = canvasRef.current.getPaths();
        if (!paths || paths.length === 0) {
            Alert.alert("Oups...", "Dessine quelque chose !");
        } else {
             // S'il a dessiné, on ouvre directement la modale de connexion
            setAuthModalVisible(true);
        }
        return; 
    }

    // Si l'utilisateur EST connecté, vérification habituelle du dessin
    const paths = canvasRef.current.getPaths();
    if (!paths || paths.length === 0) { Alert.alert("Oups", "Dessine quelque chose !"); return; }
    
    setModalVisible(true);
  };

  const handleAuthAction = async () => {
    if (!email || !password) return Alert.alert("Erreur", "Remplissez tous les champs");
    setAuthLoading(true);
    try {
        let result;
        if (isSignUp) {
            result = await supabase.auth.signUp({ email, password });
        } else {
            result = await supabase.auth.signInWithPassword({ email, password });
        }

        const { error, data } = result;
        if (error) throw error;
        
        if (isSignUp && data?.user && !data.session) {
             Alert.alert("Inscription réussie", "Veuillez vérifier vos emails pour confirmer votre compte.");
             setAuthModalVisible(false); 
             return;
        }
    } catch (e: any) {
        console.error("Auth Error:", e);
        Alert.alert("Erreur", e.message || "Une erreur est survenue lors de la connexion.");
    } finally {
        setAuthLoading(false);
    }
  };

  const confirmShare = async () => {
    if (!canvasRef.current || !cloud || !user) return;
    const finalTag = tagText.trim();
    if (finalTag.length === 0) return;

    setIsUploading(true);
    
    try {
        const pathsData = canvasRef.current.getPaths();
        const { error: dbError } = await supabase.from('drawings').insert({
            cloud_id: cloud.id, user_id: user.id, canvas_data: pathsData, cloud_image_url: cloud.image_url, label: finalTag, is_shared: true
        });
        if (dbError) throw dbError;

        setModalVisible(false);

        Animated.timing(fadeWhiteAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(() => {
            setReplayPaths(pathsData); 
            setTimeout(() => {
                Animated.timing(textOpacityAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
                setTimeout(() => {
                    Animated.parallel([
                        Animated.timing(drawingOpacityAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
                        Animated.timing(textOpacityAnim, { toValue: 0, duration: 800, useNativeDriver: true })
                    ]).start(() => {
                        router.replace({ pathname: '/(tabs)/feed', params: { justPosted: 'true' } });
                        setTimeout(() => {
                            fadeWhiteAnim.setValue(0); drawingOpacityAnim.setValue(1); textOpacityAnim.setValue(0);
                            setReplayPaths(null); setTagText(''); handleClear(); setIsUploading(false);
                        }, 1000);
                    });
                }, 2500); 
            }, 1500); 
        });
    } catch (e: any) { Alert.alert("Erreur", e.message); setIsUploading(false); }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#87CEEB" /></View>;
  if (!cloud) return <View style={styles.container}><Text style={styles.noCloudText}>Chargement...</Text></View>;

  return (
    <View style={styles.container}>
      
      {/* HEADER TOUJOURS VISIBLE (zIndex > Splash) */}
      <View style={styles.header}>
        <Text style={styles.headerText}>sunbim</Text>
        {updateLabel ? <Text style={styles.versionText}>{updateLabel}</Text> : null}
      </View>

      <View style={styles.canvasContainer}>
        {replayPaths ? (
            <DrawingViewer 
                imageUri={cloud.image_url}
                canvasData={replayPaths}
                viewerSize={screenWidth}
                viewerHeight={screenHeight}
                transparentMode={false} 
                animated={true}
                startVisible={false}
                autoCenter={true}
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
      
      {!replayPaths && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={{flex: 1}} pointerEvents="none" /> 
            <DrawingControls
                onUndo={handleUndo} onRedo={handleRedo} onClear={handleClear}
                strokeColor={strokeColor} onColorChange={setStrokeColor}
                strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
                isEraserMode={isEraserMode} toggleEraser={toggleEraser}
                onShare={handleSharePress}
                isAuthenticated={!!user} // Passage de l'état connecté/déconnecté
             />
          </View>
      )}

      {/* MODALES... */}
      <Modal animationType="slide" transparent={true} visible={authModalVisible} onRequestClose={() => setAuthModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{isSignUp ? "Créer un compte" : "Se connecter"}</Text>
                <Text style={styles.modalSubtitle}>Sauvegardez votre dessin pour le publier</Text>
                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry />
                <TouchableOpacity style={styles.validateBtn} onPress={handleAuthAction} disabled={authLoading}>
                    {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.validateText}>{isSignUp ? "S'inscrire" : "Se connecter"}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{marginTop: 15, padding: 5}}>
                    <Text style={styles.switchText}>{isSignUp ? "J'ai déjà un compte" : "Pas encore de compte ?"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAuthModalVisible(false)}>
                    <Text style={styles.cancelText}>Fermer</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Qu'as-tu vu ?</Text>
                <Text style={styles.modalSubtitle}>Donne un titre à ton œuvre</Text>
                <TextInput style={styles.input} placeholder="Ex: Un dragon..." placeholderTextColor="#999" value={tagText} onChangeText={setTagText} autoFocus={true} maxLength={30} returnKeyType="done" onSubmitEditing={confirmShare} />
                <TouchableOpacity style={styles.validateBtn} onPress={confirmShare} disabled={isUploading}>
                    {isUploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.validateText}>Publier</Text>}
                </TouchableOpacity>
                {!isUploading && <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>}
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <Animated.View 
        pointerEvents="none"
        style={[
            StyleSheet.absoluteFill, 
            { backgroundColor: 'white', opacity: fadeWhiteAnim, zIndex: 9999, justifyContent: 'center', alignItems: 'center' }
        ]} 
      >
          {replayPaths && (
              <Animated.View style={{ opacity: drawingOpacityAnim, width: screenWidth, height: screenHeight, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: screenWidth, height: screenHeight }}>
                    <DrawingViewer 
                        imageUri={cloud.image_url}
                        canvasData={replayPaths}
                        viewerSize={screenWidth}
                        viewerHeight={screenHeight} 
                        transparentMode={true} 
                        animated={true}
                        startVisible={false}
                        autoCenter={true} 
                    />
                  </View>
                  <Animated.View style={{ opacity: textOpacityAnim, position: 'absolute', bottom: 150, alignSelf: 'center' }}>
                      <Text style={styles.finalTitle}>{tagText}</Text>
                  </Animated.View>
              </Animated.View>
          )}
      </Animated.View>

      {/* --- SPLASH SCREEN INTERNE --- */}
      {showSplash && (
        <Animated.View 
            style={[
                StyleSheet.absoluteFill, 
                { 
                    backgroundColor: 'white', 
                    opacity: splashOpacity, 
                    zIndex: 5, // Inférieur au header (10) mais supérieur au canvas
                    justifyContent: 'center', 
                    alignItems: 'center',
                    paddingTop: 100 // Pour décaler le texte sous le header
                }
            ]}
            pointerEvents={showSplash ? "auto" : "none"}
        >
            <Text style={styles.splashText}>Dessine ce que tu vois</Text>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  canvasContainer: { width: '100%', height: '100%', backgroundColor: '#000' },
  
  // Header toujours au-dessus (zIndex 10)
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, paddingBottom: 15, alignItems: 'center', zIndex: 10, pointerEvents: 'none' },
  headerText: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  versionText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center' },
  errorText: { color: 'red', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#F9F9F9' },
  validateBtn: { width: '100%', height: 50, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  validateText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 10, marginTop: 5 },
  cancelText: { color: '#999', fontWeight: '600' },
  switchText: { color: '#666', fontSize: 14, textDecorationLine: 'underline' },
  finalTitle: { fontSize: 32, fontWeight: '900', color: '#000', textAlign: 'center', letterSpacing: -1, textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: {width: 0, height:0}, textShadowRadius: 10 },
  
  splashText: {
      fontSize: 24,
      fontWeight: '900',
      color: '#000',
      letterSpacing: 1
  }
});