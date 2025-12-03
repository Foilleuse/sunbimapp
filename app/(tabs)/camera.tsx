import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Cloud } from 'lucide-react-native';
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

  const uploadToSupabase = async (base64Image: string) => {
      if (!user) {
          Alert.alert("Oups", "Connecte-toi pour envoyer tes nuages !");
          return;
      }

      setIsUploading(true);
      try {
          // 1. Conversion
          const arrayBuffer = decode(base64Image);
          const fileName = `${user.id}/${Date.now()}.jpg`;

          // 2. Upload Storage (Nom du bucket avec tiret est OK ici)
          const { error: uploadError } = await supabase.storage
              .from('cloud-submissions')
              .upload(fileName, arrayBuffer, {
                  contentType: 'image/jpeg',
                  upsert: false
              });

          if (uploadError) throw uploadError;

          // 3. URL
          const { data: { publicUrl } } = supabase.storage
              .from('cloud-submissions')
              .getPublicUrl(fileName);

          // 4. Sauvegarde Base de Données
          // TENTATIVE DE CORRECTION : On utilise la syntaxe string standard.
          // Si "cloud-submissions" est le nom exact de la TABLE (pas du bucket), cela devrait marcher.
          // Si l'erreur persiste, c'est souvent un problème de Row Level Security (RLS) sur Supabase.
          const { error: dbError } = await supabase
              .from('cloud-submissions') // Assurez-vous que c'est bien le nom de la TABLE, pas juste du bucket
              .insert({
                  user_id: user.id,
                  image_url: publicUrl,
                  status: 'pending'
              });

          if (dbError) throw dbError;

          Alert.alert("Succès !", "Ton nuage a été envoyé.", [
              { text: "Super", onPress: () => router.back() }
          ]);

      } catch (e: any) {
          console.error("Erreur complète:", e);
          // Message d'erreur plus précis pour le debug
          Alert.alert("Erreur d'envoi", e.message || JSON.stringify(e));
      } finally {
          setIsUploading(false);
      }
  };

  const takePicture = async () => {
    if (cameraRef.current && !isTakingPhoto && !isUploading) {
        setIsTakingPhoto(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true,
                skipProcessing: false, 
                shutterSound: true,
            });
            
            if (photo && photo.base64) {
                await uploadToSupabase(photo.base64);
            } else {
                throw new Error("Erreur lors de la capture.");
            }

        } catch (e: any) {
            console.error("Erreur capture:", e);
            Alert.alert("Erreur", e.message);
        } finally {
            setIsTakingPhoto(false);
        }
    }
  };

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

            {isUploading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFF" />
                    <Text style={styles.loadingText}>Envoi du nuage...</Text>
                </View>
            )}
        </View>

        <View style={styles.controlsContainer}>
            <TouchableOpacity 
                style={[styles.captureBtn, (isTakingPhoto || isUploading) && { opacity: 0.5 }]} 
                onPress={takePicture} 
                activeOpacity={0.7}
                disabled={isTakingPhoto || isUploading}
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
  }
});