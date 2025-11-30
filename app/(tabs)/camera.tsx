import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Circle, Zap, ZapOff, RotateCcw } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // --- DIMENSIONS 3:4 ---
  const { width: screenWidth } = Dimensions.get('window');
  // Hauteur calculée pour un ratio 4:3 (Portrait)
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  // --- GESTION DU ZOOM (PINCH) ---
  // On utilise un geste de pincement pour contrôler le zoom (de 0 à 1)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // Formule simple pour ajuster le zoom en fonction de la vélocité du pincement
      // velocity > 0 = zoom in, velocity < 0 = zoom out
      const velocity = e.velocity / 20; 
      let newZoom = zoom + velocity * 0.01;
      
      // On borne entre 0 et 1
      newZoom = Math.max(0, Math.min(1, newZoom));
      
      // On met à jour l'état (nécessite runOnJS si on utilisait worklets, mais ici state simple)
      // Note: Pour une fluidité parfaite, on utiliserait une SharedValue Reanimated, 
      // mais le setState est suffisant pour le prop `zoom` de CameraView ici.
      setZoom(newZoom);
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

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                skipProcessing: true // Plus rapide
            });
            // Pour l'instant, on log juste le résultat ou on alerte
            // La suite logique serait de rediriger vers le DrawingCanvas avec cette image
            Alert.alert("Photo prise !", "Implémentation du dessin sur photo à venir.");
            console.log(photo?.uri);
        } catch (e) {
            console.error(e);
        }
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
            {/* Header simple pour pouvoir revenir en arrière si besoin */}
            <SunbimHeader showCloseButton={false} />

            {/* ZONE CAMÉRA 3:4 */}
            <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
                <GestureDetector gesture={pinchGesture}>
                    <CameraView 
                        ref={cameraRef}
                        style={{ flex: 1 }} 
                        facing={facing}
                        flash={flash}
                        zoom={zoom}
                        animateShutter={false}
                    />
                </GestureDetector>

                {/* OVERLAY INTERFACE (Boutons flottants sur la caméra) */}
                <View style={styles.overlay}>
                    <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
                        {flash === 'on' ? <Zap color="#FFF" size={24} /> : <ZapOff color="#FFF" size={24} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={toggleCameraFacing}>
                        <RotateCcw color="#FFF" size={24} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* BARRE DE CONTROLE (Zone noire en bas pour combler l'écran) */}
            <View style={styles.controlsContainer}>
                <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                    <View style={styles.captureInner} />
                </TouchableOpacity>
                <Text style={styles.zoomText}>Zoom: {(zoom * 10).toFixed(1)}x</Text>
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
    backgroundColor: '#333', // Placeholder pendant le chargement
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
      flexDirection: 'column',
      gap: 20,
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
      color: '#666',
      marginTop: 20,
      fontSize: 12
  }
});