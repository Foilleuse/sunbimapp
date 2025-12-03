import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Image } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Cloud, Check, X } from 'lucide-react-native'; // Ajout d'icônes pour valider/annuler
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

  // NOUVEL ÉTAT : Image capturée en attente de validation
  const [capturedImage, setCapturedImage] = useState<{ uri: string; base64?: string } | null>(null);

  const { width: screenWidth } = Dimensions.get('window');
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#fff" /></View>;
  }

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

  // 1. PRENDRE LA PHOTO (Et l'afficher en preview)
  const takePicture = async () => {
    if (cameraRef.current && !isTakingPhoto && !isUploading) {
        setIsTakingPhoto(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true, // On a besoin du base64 pour l'upload final
                skipProcessing: false, 
                shutterSound: true,
            });
            
            if (photo && photo.uri) {
                // Au lieu d'upload direct, on stocke pour prévisualisation
                setCapturedImage({ uri: photo.uri, base64: photo.base64 });
            } else {
                throw new Error("Aucune image retournée par la caméra.");
            }

        } catch (e: any) {
            console.error("Erreur capture:", e);
            Alert.alert("Erreur", e.message || "Impossible de prendre la photo.");
        } finally {
            setIsTakingPhoto(false);
        }
    }
  };

  // 2. ANNULER LA PHOTO (Retour caméra)
  const retakePicture = () => {
      setCapturedImage(null);
  };

  // 3. CONFIRMER ET UPLOAD
  const confirmUpload = async () => {
      if (!capturedImage?.base64) return;
      await uploadToSupabase(capturedImage.base64);
  };

  const uploadToSupabase = async (base64Image: string) => {
      if (!user) {
          Alert.alert("Oups", "Connecte-toi pour envoyer tes nuages !");
          return;
      }

      setIsUploading(true);
      try {
          const arrayBuffer = decode(base64Image);
          const fileName = `${user.id}/${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
              .from('cloud-submissions')
              .upload(fileName, arrayBuffer, {
                  contentType: 'image/jpeg',
                  upsert: false
              });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('cloud-submissions')
              .getPublicUrl(fileName);

          const { error: dbError } = await supabase
              .from('cloud_submissions')
              .insert({
                  user_id: user.id,
                  image_url: publicUrl,
                  status: 'pending'
              });

          if (dbError) throw dbError;

          Alert.alert("Succès !", "Ton nuage a été envoyé.", [
              { text: "Super", onPress: () => {
                  setCapturedImage(null); // Reset
                  router.back(); 
              }}
          ]);

      } catch (e: any) {
          console.error("Erreur upload:", e);
          Alert.alert("Erreur d'envoi", e.message || "Impossible d'envoyer le nuage.");
      } finally {
          setIsUploading(false);
      }
  };

  // --- MODE PREVIEW (Si une image est capturée) ---
  if (capturedImage) {
      return (
        <View style={styles.container}>
            <SunbimHeader showCloseButton={true} onClose={retakePicture} />
            
            <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
                <Image source={{ uri: capturedImage.uri }} style={{ flex: 1 }} resizeMode="cover" />
                
                {/* Overlay de chargement si en cours d'envoi */}
                {isUploading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#FFF" />
                        <Text style={styles.loadingText}>Envoi du nuage...</Text>
                    </View>
                )}
            </View>

            {/* BARRE DE VALIDATION */}
            <View style={styles.previewControls}>
                {/* Bouton Annuler */}
                <TouchableOpacity style={[styles.actionBtn, styles.retakeBtn]} onPress={retakePicture} disabled={isUploading}>
                    <X color="#FFF" size={32} />
                </TouchableOpacity>

                {/* Bouton Valider */}
                <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={confirmUpload} disabled={isUploading}>
                    <Check color="#000" size={32} />
                </TouchableOpacity>
            </View>
        </View>
      );
  }

  // --- MODE CAMÉRA (Par défaut) ---
  return (
    <View style={styles.container}>
        <SunbimHeader showCloseButton={true} onClose={() => router.back()} />

        <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
            <CameraView 
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                zoom={zoom}
                animateShutter={false}
                flash="off" 
            />
            
            <View style={styles.zoomContainer}>
                {['1x', '1.5x', '2x'].map((z) => {
                    let isActive = false;
                    if (z === '1x' && zoom === 0) isActive = true;
                    if (z === '1.5x' && zoom === 0.005) isActive = true;
                    if (z === '2x' && zoom === 0.01) isActive = true;

                    return (
                        <TouchableOpacity 
                            key={z} 
                            style={[styles.zoomBtn, isActive && styles.zoomBtnActive]} 
                            onPress={() => handleZoom(z)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.zoomText, isActive && styles.zoomTextActive]}>
                                {z}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>

        <View style={styles.controlsContainer}>
            <TouchableOpacity 
                style={[styles.captureBtn, isTakingPhoto && { opacity: 0.5 }]} 
                onPress={takePicture} 
                activeOpacity={0.7}
                disabled={isTakingPhoto}
            >
                {isTakingPhoto ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Cloud color="#FFF" size={72} fill="#FFF" />
                )}
            </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 50
  },
  loadingText: {
      color: '#FFF',
      marginTop: 10,
      fontWeight: '600'
  },
  message: { textAlign: 'center', color: '#FFF', marginTop: 100 },
  permissionBtn: {
      marginTop: 20,
      alignSelf: 'center',
      backgroundColor: '#FFF',
      padding: 15,
      borderRadius: 10
  },
  permissionText: { fontWeight: 'bold', color: '#000' },
  
  zoomContainer: {
      position: 'absolute',
      bottom: 20, 
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 20,
      padding: 6,
      gap: 10,
  },
  zoomBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent'
  },
  zoomBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  zoomText: { color: '#CCC', fontWeight: '600', fontSize: 12 },
  zoomTextActive: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  controlsContainer: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 20
  },
  captureBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 10,
  },
  
  // --- STYLES PREVIEW ---
  previewControls: {
      flex: 1,
      backgroundColor: '#000',
      flexDirection: 'row',
      justifyContent: 'space-around', // Espacement équilibré
      alignItems: 'center',
      paddingBottom: 20
  },
  actionBtn: {
      width: 70,
      height: 70,
      borderRadius: 35,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
  },
  retakeBtn: {
      backgroundColor: 'transparent',
      borderColor: '#FFF',
  },
  confirmBtn: {
      backgroundColor: '#FFF',
      borderColor: '#FFF',
  }
});