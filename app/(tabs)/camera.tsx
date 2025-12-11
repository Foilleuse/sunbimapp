import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Image } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Cloud, Check, X } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';
import { decode } from 'base64-arraybuffer';

export default function CameraPage() {
  const { user } = useAuth();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false); 
  const [isUploading, setIsUploading] = useState(false);

  // État de l'image capturée
  const [capturedImage, setCapturedImage] = useState<{ uri: string; base64?: string } | null>(null);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // CALCUL DU RATIO 3:4
  // La hauteur de la caméra doit être exactement 4/3 de la largeur
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) return <View style={styles.container}><ActivityIndicator size="large" color="#fff" /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Permission caméra requise.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>Accorder</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleZoom = (label: string) => {
      switch (label) {
          case '1x': setZoom(0); break;
          case '1.5x': setZoom(0.005); break; 
          case '2x': setZoom(0.01); break;
          default: setZoom(0);
      }
  };

  // 1. PRENDRE LA PHOTO
  const takePicture = async () => {
    if (cameraRef.current && !isTakingPhoto && !isUploading) {
        setIsTakingPhoto(true);
        try {
            // Sans manipulateur, on prend la photo telle quelle.
            // Comme le composant CameraView est contraint en 3:4 par le style,
            // et que le capteur est nativement 4:3 sur la plupart des téléphones,
            // l'image sortira au bon ratio.
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true, 
                skipProcessing: false, 
                shutterSound: true,
            });
            
            if (photo && photo.uri) {
                setCapturedImage({ uri: photo.uri, base64: photo.base64 });
            } else {
                throw new Error("Erreur capture photo.");
            }
        } catch (e: any) {
            console.error("Erreur capture:", e);
            Alert.alert("Erreur", "Impossible de prendre la photo.");
        } finally {
            setIsTakingPhoto(false);
        }
    }
  };

  const retakePicture = () => setCapturedImage(null);

  const confirmUpload = async () => {
      if (!capturedImage?.base64) return;
      await uploadToSupabase(capturedImage.base64);
  };

  const uploadToSupabase = async (base64Image: string) => {
      if (!user) return Alert.alert("Oups", "Connecte-toi pour envoyer tes nuages !");

      setIsUploading(true);
      try {
          const arrayBuffer = decode(base64Image);
          const fileName = `${user.id}/${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
              .from('cloud-submissions')
              .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('cloud-submissions')
              .getPublicUrl(fileName);

          const { error: dbError } = await supabase
              .from('cloud_submissions')
              .insert({ user_id: user.id, image_url: publicUrl, status: 'pending' });

          if (dbError) throw dbError;

          Alert.alert("Succès !", "Ton nuage a été envoyé.", [
              { text: "Super", onPress: () => { setCapturedImage(null); router.back(); }}
          ]);

      } catch (e: any) {
          console.error("Erreur upload:", e);
          Alert.alert("Erreur d'envoi", e.message);
      } finally {
          setIsUploading(false);
      }
  };

  // --- RENDU ---
  return (
    <View style={styles.container}>
        {/* On force le header transparent pour qu'il s'affiche SUR le fond noir du container, mais le SunbimHeader gère la couleur de texte en fonction du prop transparent */}
        {/* Pour obtenir un header noir, on utilise le style du container (noir) et on rend le header "transparent" pour le fond, mais en ajustant ses couleurs de texte si nécessaire. */}
        {/* Cependant, SunbimHeader gère "transparent" comme "texte blanc sur fond transparent". C'est parfait ici car le fond derrière est noir. */}
        <View style={{ backgroundColor: '#000', width: '100%' }}>
            <SunbimHeader 
                showCloseButton={true} 
                onClose={() => capturedImage ? retakePicture() : router.back()} 
                transparent={true} 
            />
        </View>

        {/* ZONE CAMÉRA / PREVIEW : Hauteur Fixe 3:4 */}
        <View style={{ width: screenWidth, height: CAMERA_HEIGHT, backgroundColor: '#000', marginTop: 0 }}>
            {capturedImage ? (
                // Mode Prévisualisation (Image figée)
                <Image 
                    source={{ uri: capturedImage.uri }} 
                    style={{ width: '100%', height: '100%' }} 
                    resizeMode="cover" 
                />
            ) : (
                // Mode Caméra Live
                <CameraView 
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                    zoom={zoom}
                    animateShutter={false}
                    flash="off" 
                />
            )}

            {/* Overlay Zoom (uniquement en mode caméra) */}
            {!capturedImage && (
                <View style={styles.zoomOverlay}>
                     {['1x', '1.5x', '2x'].map((z) => {
                        let isActive = (z === '1x' && zoom === 0) || (z === '1.5x' && zoom === 0.005) || (z === '2x' && zoom === 0.01);
                        return (
                            <TouchableOpacity key={z} style={[styles.zoomBtn, isActive && styles.zoomBtnActive]} onPress={() => handleZoom(z)}>
                                <Text style={[styles.zoomText, isActive && styles.zoomTextActive]}>{z}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Overlay Loading */}
            {isUploading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFF" />
                    <Text style={styles.loadingText}>Envoi du nuage...</Text>
                </View>
            )}
        </View>

        {/* ZONE NOIRE DU BAS (Reste de l'écran) */}
        {/* C'est ici qu'on met les contrôles, en dehors de la zone photo */}
        <View style={styles.bottomControlArea}>
            
            {capturedImage ? (
                // --- CONTRÔLES DE VALIDATION ---
                <View style={styles.validationRow}>
                     <TouchableOpacity style={[styles.actionBtn, styles.retakeBtn]} onPress={retakePicture} disabled={isUploading}>
                        <X color="#FFF" size={32} />
                    </TouchableOpacity>
                    <Text style={styles.previewText}>Ça te plaît ?</Text>
                    <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={confirmUpload} disabled={isUploading}>
                        <Check color="#000" size={32} />
                    </TouchableOpacity>
                </View>
            ) : (
                // --- CONTRÔLES DE CAPTURE ---
                <View style={styles.captureColumn}>
                    <Text style={styles.propositionText}>Propose un nuage du jour !</Text>
                    
                    <TouchableOpacity 
                        style={[styles.captureBtn, isTakingPhoto && { opacity: 0.5 }]} 
                        onPress={takePicture} 
                        activeOpacity={0.7}
                        disabled={isTakingPhoto}
                    >
                        {isTakingPhoto ? <ActivityIndicator color="#FFF" /> : <Cloud color="#FFF" size={60} fill="#FFF" />}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // --- CAMERA ZONE ---
  zoomOverlay: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
    gap: 8,
  },
  zoomBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  zoomBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  zoomText: { color: '#CCC', fontSize: 11, fontWeight: '600' },
  zoomTextActive: { color: '#FFF', fontWeight: 'bold' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  loadingText: { color: '#FFF', marginTop: 10, fontWeight: '600' },

  // --- BOTTOM BLACK AREA ---
  bottomControlArea: {
      flex: 1, // Prend tout l'espace restant en bas
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 20, // Marge du bas
  },
  
  // Mode Capture
  captureColumn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
  },
  propositionText: {
      color: '#FFF',
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 15, // Espace entre texte et bouton
      textAlign: 'center'
  },
  captureBtn: {
      // Pas de fond, juste l'icône, ou un cercle subtil
      padding: 10,
  },

  // Mode Validation
  validationRow: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-around',
      alignItems: 'center',
  },
  previewText: {
      color: '#CCC',
      fontSize: 16,
      fontWeight: '600'
  },
  actionBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  retakeBtn: { backgroundColor: 'transparent', borderColor: '#FFF' },
  confirmBtn: { backgroundColor: '#FFF', borderColor: '#FFF' },

  // Permissions
  message: { textAlign: 'center', color: '#FFF', marginTop: 100 },
  permissionBtn: { marginTop: 20, alignSelf: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 10 },
  permissionText: { fontWeight: 'bold', color: '#000' },
});