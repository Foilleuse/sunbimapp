import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Cloud } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/contexts/AuthContext';

export default function CameraPage() {
  const { user } = useAuth();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  // Permissions : Seulement la caméra maintenant
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // États
  const [zoom, setZoom] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  useEffect(() => {
    (async () => {
        if (!cameraPermission?.granted) await requestCameraPermission();
    })();
  }, []);

  if (!cameraPermission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Permission caméra nécessaire.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
          <Text style={styles.permissionText}>Autoriser</Text>
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

  const uploadToSupabase = async (uri: string) => {
      if (!user) {
          Alert.alert("Erreur", "Vous devez être connecté pour envoyer un nuage.");
          return;
      }

      setIsUploading(true);
      try {
          // Suppression de la logique de localisation ici

          const response = await fetch(uri);
          const blob = await response.blob();
          const fileExt = uri.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
              .from('cloud-submissions')
              .upload(filePath, blob);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('cloud-submissions')
              .getPublicUrl(filePath);

          // Insertion sans lat/long
          const { error: dbError } = await supabase
              .from('cloud_submissions')
              .insert({
                  user_id: user.id,
                  image_url: publicUrl,
                  // latitude et longitude retirés
                  status: 'pending'
              });

          if (dbError) throw dbError;

          Alert.alert("Succès !", "Ton nuage a été envoyé.", [
              { text: "Super", onPress: () => router.back() }
          ]);

      } catch (e: any) {
          console.error("Upload error:", e);
          Alert.alert("Erreur d'envoi", e.message || "Impossible d'envoyer le nuage.");
      } finally {
          setIsUploading(false);
      }
  };

  const takePicture = async () => {
    if (cameraRef.current && !isUploading) {
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: false,
                skipProcessing: true,
                shutterSound: true
            });
            
            if (photo) {
                await uploadToSupabase(photo.uri);
            }
        } catch (e) {
            console.error("Erreur capture:", e);
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
                flash="off"
                animateShutter={false}
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
                style={[styles.captureBtn, isUploading && { opacity: 0.5 }]} 
                onPress={takePicture} 
                activeOpacity={0.7}
                disabled={isUploading}
            >
                <Cloud color="#FFF" size={72} fill="#FFF" />
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