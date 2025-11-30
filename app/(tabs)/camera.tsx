import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SunbimHeader } from '../../src/components/SunbimHeader';
import { Cloud } from 'lucide-react-native'; // <--- Import de l'icône nuage

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  const { width: screenWidth } = Dimensions.get('window');
  // Format 3:4
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Permission caméra requise pour capturer les nuages.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>Accorder la permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Gestion simplifiée du zoom pour Expo (0 = pas de zoom, 1 = max zoom)
  // Les valeurs sont approximatives pour simuler 1.5x et 2x car on ne connait pas le max zoom du device
  const handleZoom = (label: string) => {
      switch (label) {
          case '1x': setZoom(0); break;
          case '1.5x': setZoom(0.005); break; 
          case '2x': setZoom(0.01); break;
          default: setZoom(0);
      }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                skipProcessing: true,
                shutterSound: true
            });
            
            if (photo) {
                Alert.alert("Photo prise !", `Chemin : ${photo.uri}`);
                console.log("Photo uri:", photo.uri);
            }
        } catch (e) {
            console.error("Erreur capture:", e);
            Alert.alert("Erreur", "Impossible de prendre la photo.");
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
                flash="off" // Flash désactivé par défaut
            />
            
            {/* Barre de Zoom par dessus l'image (bas) */}
            <View style={styles.zoomContainer}>
                {['1x', '1.5x', '2x'].map((z) => {
                    // Déterminer si ce bouton est actif
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

        {/* Zone de contrôle noire */}
        <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture} activeOpacity={0.7}>
                {/* Remplacement du cercle par un nuage */}
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
  message: { textAlign: 'center', color: '#FFF', marginTop: 100 },
  permissionBtn: {
      marginTop: 20,
      alignSelf: 'center',
      backgroundColor: '#FFF',
      padding: 15,
      borderRadius: 10
  },
  permissionText: {
      fontWeight: 'bold',
      color: '#000'
  },
  
  // STYLES ZOOM (Overlay sur l'image)
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
  zoomBtnActive: {
      backgroundColor: 'rgba(255,255,255,0.3)', 
  },
  zoomText: {
      color: '#CCC',
      fontWeight: '600',
      fontSize: 12
  },
  zoomTextActive: {
      color: '#FFF', 
      fontWeight: 'bold',
      fontSize: 13
  },

  controlsContainer: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 20
  },
  captureBtn: {
      // Styles simplifiés pour le conteneur de l'icône
      justifyContent: 'center',
      alignItems: 'center',
      padding: 10,
  },
  // Le style captureInner est supprimé car il n'est plus utilisé
});