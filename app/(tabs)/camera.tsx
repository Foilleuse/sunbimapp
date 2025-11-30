import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Zap, ZapOff } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';
// Imports essentiels pour le geste
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [zoom, setZoom] = useState(0); // État du zoom (0 à 1)
  
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // On utilise une ref pour stocker le zoom de départ du geste
  const startZoom = useRef(0);

  const { width: screenWidth } = Dimensions.get('window');
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  // --- GESTION DU ZOOM (PINCH) ---
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.current = zoom;
    })
    .onUpdate((e) => {
      // Calcul du nouveau zoom basé sur l'échelle du pincement
      // e.scale : 1 = pas de changement, 2 = double, 0.5 = moitié
      // On divise par 50 ou une constante pour adoucir la sensibilité
      // Une autre formule classique :
      const velocity = 0.001; // Sensibilité
      let newZoom = startZoom.current + (e.scale - 1) * 0.5; // On multiplie l'écart par un facteur

      // Borner entre 0 et 1
      newZoom = Math.max(0, Math.min(1, newZoom));
      
      // Mise à jour via runOnJS car on est dans un worklet UI
      runOnJS(setZoom)(newZoom);
    });

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Nous avons besoin de votre permission pour utiliser la caméra.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>Accorder la permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                skipProcessing: true 
            });
            Alert.alert("Photo prise !", "Implémentation du dessin sur photo à venir.");
            console.log(photo?.uri);
        } catch (e) {
            console.error(e);
        }
    }
  };

  return (
    // GestureHandlerRootView est ESSENTIEL pour que les gestes fonctionnent
    <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
            <SunbimHeader showCloseButton={true} onClose={() => router.back()} />

            <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
                {/* Le GestureDetector enveloppe la zone interactive */}
                <GestureDetector gesture={pinch}>
                    <View style={{ flex: 1 }}>
                        <CameraView 
                            ref={cameraRef}
                            style={{ flex: 1 }} 
                            facing="back"
                            flash={flash}
                            zoom={zoom} // On passe le zoom calculé ici
                            animateShutter={false}
                        />
                        
                        {/* Overlay Flash */}
                        <View style={styles.overlay} pointerEvents="box-none">
                            <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
                                {flash === 'on' ? <Zap color="#FFF" size={24} /> : <ZapOff color="#FFF" size={24} />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </GestureDetector>
            </View>

            <View style={styles.controlsContainer}>
                <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                    <View style={styles.captureInner} />
                </TouchableOpacity>
                {/* Indicateur de zoom */}
                <Text style={styles.zoomText}>x{(1 + zoom * 4).toFixed(1)}</Text>
            </View>
        </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    overflow: 'hidden',
    backgroundColor: '#333',
    position: 'relative',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#FFF'
  },
  permissionBtn: {
      backgroundColor: '#FFF',
      padding: 15,
      borderRadius: 10
  },
  permissionText: {
      fontWeight: 'bold'
  },
  overlay: {
      position: 'absolute',
      top: 20,
      right: 20,
  },
  iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  controlsContainer: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 20
  },
  captureBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FFF',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: 'rgba(255,255,255,0.3)'
  },
  captureInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#FFF',
      borderWidth: 2,
      borderColor: '#000'
  },
  zoomText: {
      color: '#999',
      marginTop: 15,
      fontSize: 14,
      fontWeight: 'bold'
  }
});