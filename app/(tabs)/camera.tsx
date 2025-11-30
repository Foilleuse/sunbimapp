import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Zap, ZapOff } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // On stocke le zoom "courant" dans une ref pour le calcul du pinch
  // Cela évite les sauts brusques lors du geste
  const baseZoom = useRef(0);

  const { width: screenWidth } = Dimensions.get('window');
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  // --- GESTION DU ZOOM (PINCH) ---
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      // Au début du geste, on mémorise le zoom actuel
      baseZoom.current = zoom;
    })
    .onUpdate((e) => {
      // e.scale commence à 1. 
      // Si scale > 1 (zoom in), on augmente. Si scale < 1 (zoom out), on diminue.
      // On utilise un facteur multiplicateur pour rendre le zoom naturel.
      
      // Formule : NouveauZoom = ZoomInitial + (Scale - 1) * Sensibilité
      let newZoom = baseZoom.current + (e.scale - 1) * 0.1; // 0.1 est la sensibilité

      // Borner entre 0 et 1 (Expo Camera gère le zoom de 0 à 1)
      newZoom = Math.max(0, Math.min(1, newZoom));
      
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
    <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
            <SunbimHeader showCloseButton={true} onClose={() => router.back()} />

            <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
                {/* Le GestureDetector doit englober la CameraView */}
                <GestureDetector gesture={pinchGesture}>
                    <View style={{ flex: 1 }}> 
                        <CameraView 
                            ref={cameraRef}
                            style={{ flex: 1 }} 
                            facing="back"
                            flash={flash}
                            zoom={zoom}
                            animateShutter={false}
                        />
                        
                        {/* Overlay Flash (Doit être DANS le GestureDetector pour recevoir les touches si besoin, ou au dessus) */}
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
                {/* Affichage du zoom en % pour être plus parlant */}
                <Text style={styles.zoomText}>Zoom: {Math.round(zoom * 100)}%</Text>
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
      // Important : box-none permet de cliquer sur le bouton flash sans bloquer le pinch en dessous
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