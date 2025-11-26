import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { DrawingCanvas, DrawingCanvasRef } from '../src/components/DrawingCanvas';
import { DrawingViewer } from '../src/components/DrawingViewer'; 
import { DrawingControls } from '../src/components/DrawingControls';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import * as Updates from 'expo-updates';

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
  const { width: screenWidth } = Dimensions.get('window');
  
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // NOUVEAU : État pour savoir si déjà joué
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [myTodaysDrawing, setMyTodaysDrawing] = useState<any>(null);

  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraserMode, setIsEraserMode] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [replayPaths, setReplayPaths] = useState<any[] | null>(null);
  
  const fadeWhiteAnim = useRef(new Animated.Value(0)).current; 
  const drawingOpacityAnim = useRef(new Animated.Value(1)).current; 
  const textOpacityAnim = useRef(new Animated.Value(0)).current; 

  const canvasRef = useRef<DrawingCanvasRef>(null);
  const updateLabel = (Updates && Updates.updateId) ? `v.${Updates.updateId.substring(0, 6)}` : '';

  useEffect(() => {
    let isMounted = true;
    const forceStopLoading = setTimeout(() => {
        if (isMounted) {
            setLoading(false);
            setCloud(prev => prev || FALLBACK_CLOUD);
        }
    }, 2000);

    const loadData = async () => {
        try {
            if (!supabase) throw new Error("No Supabase");
            const today = new Date().toISOString().split('T')[0];
            
            // 1. On récupère le nuage
            const { data: cloudData } = await supabase.from('clouds').select('*').eq('published_for', today).maybeSingle();
            
            // 2. SI CONNECTÉ : On vérifie si j'ai déjà joué
            if (user && cloudData) {
                const { data: existingDrawing } = await supabase
                    .from('drawings')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('cloud_id', cloudData.id)
                    .maybeSingle();
                
                if (existingDrawing) {
                    console.log("Déjà joué aujourd'hui !");
                    if (isMounted) {
                        setHasPlayedToday(true);
                        setMyTodaysDrawing(existingDrawing);
                    }
                }
            }

            if (isMounted) {
                if (cloudData) setCloud(cloudData);
                else setCloud(FALLBACK_CLOUD);
            }
        } catch (err) {
            if (isMounted) setCloud(FALLBACK_CLOUD);
        } finally {
            if (isMounted) setLoading(false);
        }
    };
    loadData();
    return () => { isMounted = false; clearTimeout(forceStopLoading); };
  }, [user]); // On recharge si l'user change (connexion)

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const toggleEraser = () => setIsEraserMode((prev) => !prev);

  const handleSharePress = () => {
    if (!canvasRef.current) return;
    const paths = canvasRef.current.getPaths();
    if (!paths || paths.length === 0) { Alert.alert("Oups", "Dessine quelque chose !"); return; }
    
    if (!user) {
        Alert.alert("Connexion requise", "Connecte-toi pour participer.", [
            { text: "Annuler", style: "cancel" },
            { text: "Se connecter", onPress: () => router.push('/profile') }
        ]);
        return;
    }
    setModalVisible(true);
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
                        // Après le post, on considère qu'il a joué pour l'état local
                        setHasPlayedToday(true); 
                        
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
  if (!cloud) return <View style={styles.container}><Text style={styles.noCloudText}>Erreur chargement.</Text></View>;

  // --- CAS DÉJÀ JOUÉ : ON BLOQUE L'ACCÈS ---
  if (hasPlayedToday && myTodaysDrawing) {
      return (
        <View style={styles.container}>
            <View style={styles.header}><Text style={styles.headerText}>sunbim</Text></View>
            
            {/* On affiche le dessin de l'utilisateur en lecture seule */}
            <View style={styles.canvasContainer}>
                <DrawingViewer 
                    imageUri={cloud.image_url}
                    canvasData={myTodaysDrawing.canvas_data}
                    viewerSize={screenWidth}
                    transparentMode={false} 
                    animated={true} // Petite anim pour le plaisir
                    startVisible={false}
                />
                {/* Overlay de blocage */}
                <View style={styles.lockOverlay}>
                    <Text style={styles.lockTitle}>À demain !</Text>
                    <Text style={styles.lockSubtitle}>Tu as déjà participé au nuage du jour.</Text>
                    
                    <TouchableOpacity style={styles.goToFeedBtn} onPress={() => router.push('/(tabs)/feed')}>
                        <Text style={styles.goToFeedText}>Voir les autres dessins</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      );
  }

  // --- CAS NORMAL : ON DESSINE ---
  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <Text style={styles.headerText}>sunbim</Text>
        {updateLabel ? <Text style={styles.versionText}>{updateLabel}</Text> : null}
      </View>

      <View style={styles.canvasContainer}>
        {replayPaths ? (
            <DrawingViewer 
                imageUri={cloud.image_url} canvasData={replayPaths} viewerSize={screenWidth} transparentMode={false} animated={true} startVisible={false}
            />
        ) : (
            <DrawingCanvas
              ref={canvasRef} imageUri={cloud.image_url} strokeColor={strokeColor} strokeWidth={strokeWidth} isEraserMode={isEraserMode} onClear={handleClear}
            />
        )}
      </View>
      
      {!replayPaths && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={{flex: 1}} pointerEvents="none" /> 
            <DrawingControls
                onUndo={handleUndo} onRedo={handleRedo} onClear={handleClear}
                strokeColor={strokeColor} onColorChange={setStrokeColor} strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
                isEraserMode={isEraserMode} toggleEraser={toggleEraser} onShare={handleSharePress}
             />
          </View>
      )}

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

      <Animated.View 
        pointerEvents="none"
        style={[ StyleSheet.absoluteFill, { backgroundColor: 'white', opacity: fadeWhiteAnim, zIndex: 9999, justifyContent: 'center', alignItems: 'center' } ]} 
      >
          {replayPaths && (
              <Animated.View style={{ opacity: drawingOpacityAnim, width: screenWidth, alignItems: 'center' }}>
                  <View style={{ height: screenWidth, width: screenWidth }}>
                    <DrawingViewer 
                        imageUri={cloud.image_url} canvasData={replayPaths} viewerSize={screenWidth} transparentMode={true} animated={true} startVisible={false}
                    />
                  </View>
                  <Animated.View style={{ opacity: textOpacityAnim, marginTop: 40, alignItems: 'center' }}>
                      <Text style={styles.finalTitle}>{tagText}</Text>
                  </Animated.View>
              </Animated.View>
          )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvasContainer: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, paddingBottom: 15, alignItems: 'center', zIndex: 10, pointerEvents: 'none' },
  headerText: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  versionText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  noCloudText: { fontSize: 18, color: '#666', textAlign: 'center', marginTop: 100 },
  errorText: { color: 'red', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#F9F9F9' },
  validateBtn: { width: '100%', height: 50, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  validateText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 10 },
  cancelText: { color: '#999', fontWeight: '600' },
  finalTitle: { fontSize: 32, fontWeight: '900', color: '#000', textAlign: 'center', letterSpacing: -1 },
  
  // STYLES LOCK SCREEN
  lockOverlay: {
      position: 'absolute', bottom: 50, left: 20, right: 20,
      backgroundColor: 'rgba(0,0,0,0.8)', padding: 30, borderRadius: 20,
      alignItems: 'center'
  },
  lockTitle: { color: '#FFF', fontSize: 24, fontWeight: '900', marginBottom: 10 },
  lockSubtitle: { color: '#CCC', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  goToFeedBtn: { backgroundColor: '#FFF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  goToFeedText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});