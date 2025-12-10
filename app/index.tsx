import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Dimensions, AppState, Image } from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingViewer } from '../src/components/DrawingViewer'; 
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import * as Updates from 'expo-updates';
import React from 'react';
// Ajout des imports pour l'auth sociale
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

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
  const [subPrompt, setSubPrompt] = useState<string>(''); 
  const [loading, setLoading] = useState(true);
  
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current; 
  const blurAnim = useRef(new Animated.Value(15)).current;
  const [canvasBlur, setCanvasBlur] = useState(15);
  
  const [strokeColor, setStrokeColor] = useState('#000000');
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

  // --- CONFIGURATION GOOGLE SIGNIN (Au montage) ---
  useEffect(() => {
    GoogleSignin.configure({
      iosClientId: '296503578118-pdqa6300t0r1l315e94nn07uuj8fdepq.apps.googleusercontent.com', // À REMPLACER
      webClientId: '296503578118-9otrhg40mnenuvh1ir16o4qoujhvmb74.apps.googleusercontent.com', // À REMPLACER
      scopes: ['profile', 'email'],
    });
  }, []);

  // --- FONCTIONS SOCIAL LOGIN ---
  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.idToken) {
        setAuthLoading(true);
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.idToken,
        });
        if (error) throw error;
        // La redirection ou la fermeture de modale sera gérée par le useEffect sur 'user'
      }
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED && error.code !== statusCodes.IN_PROGRESS) {
        Alert.alert("Erreur Google", error.message);
      }
      setAuthLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        setAuthLoading(true);
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert("Erreur Apple", e.message);
      }
      setAuthLoading(false);
    }
  };


  useEffect(() => {
    const listener = blurAnim.addListener(({ value }) => {
        setCanvasBlur(value);
    });

    const timer = setTimeout(() => {
        Animated.parallel([
            Animated.timing(splashOpacity, {
                toValue: 0,
                duration: 800, 
                useNativeDriver: true,
            }),
            Animated.timing(blurAnim, {
                toValue: 0, 
                duration: 800,
                useNativeDriver: false, 
            })
        ]).start(() => {
            setShowSplash(false); 
        });
    }, 2000); 

    return () => {
        clearTimeout(timer);
        blurAnim.removeListener(listener);
    };
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
        // Si on a un dessin en attente, on ouvre la modale de partage
        if (canvasRef.current?.getPaths().length > 0 && !modalVisible && !replayPaths) {
             setModalVisible(true);
        }
    }
  }, [user]);

  const checkStatusAndLoad = async () => {
    if (!cloud) {
        setLoading(true); 
    }
    
    try {
        if (!supabase) throw new Error("No Supabase");
        const today = new Date().toISOString().split('T')[0];
        
        const [cloudResponse, promptResponse] = await Promise.all([
            supabase.from('clouds').select('*').eq('published_for', today).maybeSingle(),
            supabase.from('daily_prompts').select('content').eq('is_active', true) 
        ]);

        const { data: cloudData, error: cloudError } = cloudResponse;
        
        if (promptResponse.data && promptResponse.data.length > 0) {
            const randomIndex = Math.floor(Math.random() * promptResponse.data.length);
            setSubPrompt(promptResponse.data[randomIndex].content);
        }

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
    
    if (!user) { 
        const paths = canvasRef.current.getPaths();
        if (!paths || paths.length === 0) {
            Alert.alert("Oups...", "Dessine quelque chose !");
        } else {
            setAuthModalVisible(true);
        }
        return; 
    }

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
              blurRadius={showSplash ? canvasBlur : 0}
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
                isAuthenticated={!!user} 
             />
          </View>
      )}

      {/* MODALE CONNEXION (Mise à jour avec boutons sociaux) */}
      <Modal animationType="slide" transparent={true} visible={authModalVisible} onRequestClose={() => setAuthModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{isSignUp ? "Créer un compte" : "Se connecter"}</Text>
                <Text style={styles.modalSubtitle}>Sauvegardez votre dessin pour le publier</Text>
                
                {/* BOUTONS SOCIAUX */}
                <View style={styles.socialContainer}>
                    {Platform.OS === 'ios' && (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                            cornerRadius={5}
                            style={{ width: '100%', height: 44, marginBottom: 10 }}
                            onPress={handleAppleLogin}
                        />
                    )}
                    
                    {/* Bouton Google Personnalisé (pour style cohérent) */}
                    <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
                        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                           {/* Cercle coloré pour simuler logo G */}
                           <View style={{width:20, height:20, borderRadius:10, backgroundColor:'#FFF', justifyContent:'center', alignItems:'center', marginRight: 10}}>
                                <Text style={{color:'#DB4437', fontWeight:'bold', fontSize:14}}>G</Text>
                           </View>
                           <Text style={styles.googleBtnText}>Continuer avec Google</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{flexDirection: 'row', alignItems: 'center', marginVertical: 15, width: '100%'}}>
                    <View style={{flex: 1, height: 1, backgroundColor: '#EEE'}} />
                    <Text style={{marginHorizontal: 10, color: '#999'}}>OU</Text>
                    <View style={{flex: 1, height: 1, backgroundColor: '#EEE'}} />
                </View>

                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry />
                
                <TouchableOpacity style={styles.validateBtn} onPress={handleAuthAction} disabled={authLoading}>
                    {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.validateText}>{isSignUp ? "S'inscrire par email" : "Se connecter par email"}</Text>}
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

      {/* --- SPLASH SCREEN TRANSPARENT AVEC TEXTE ET SOUS-TEXTE --- */}
      {showSplash && cloud && (
        <Animated.View 
            style={[
                StyleSheet.absoluteFill, 
                { 
                    backgroundColor: 'transparent', 
                    opacity: splashOpacity, 
                    zIndex: 5, 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    paddingTop: 100 
                }
            ]}
            pointerEvents={showSplash ? "auto" : "none"}
        >
            {subPrompt ? (
                <Text style={[styles.splashSubText, styles.splashTextShadow]}>{subPrompt}</Text>
            ) : null}
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  canvasContainer: { width: '100%', height: '100%', backgroundColor: '#000' },
  
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, paddingBottom: 15, alignItems: 'center', zIndex: 10, pointerEvents: 'none' },
  headerText: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  versionText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center' },
  errorText: { color: 'red', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#F9F9F9' },
  validateBtn: { width: '100%', height: 50, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  validateText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 10, marginTop: 5 },
  cancelText: { color: '#999', fontWeight: '600' },
  switchText: { color: '#666', fontSize: 14, textDecorationLine: 'underline' },
  finalTitle: { fontSize: 32, fontWeight: '900', color: '#000', textAlign: 'center', letterSpacing: -1, textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: {width: 0, height:0}, textShadowRadius: 10 },
  
  splashText: {
      fontSize: 24,
      fontWeight: '900',
      color: '#FFFFFF', 
      letterSpacing: 1,
      textAlign: 'center'
  },
  splashSubText: {
      fontSize: 22, 
      fontWeight: '700',
      color: '#FFFFFF', 
      marginTop: 10,
      textAlign: 'center',
      paddingHorizontal: 30, 
      lineHeight: 30 
  },
  splashTextShadow: {
      textShadowColor: 'rgba(0,0,0,0.7)', 
      textShadowOffset: { width: 1, height: 1 }, 
      textShadowRadius: 5
  },

  // Styles pour les boutons sociaux
  socialContainer: {
      width: '100%',
      marginBottom: 10,
  },
  googleBtn: {
      width: '100%',
      height: 44,
      backgroundColor: '#DB4437',
      borderRadius: 5,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
  },
  googleBtnText: {
      color: '#FFF',
      fontWeight: 'bold',
      fontSize: 16,
  }
});