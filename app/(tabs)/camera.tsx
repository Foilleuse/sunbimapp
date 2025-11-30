import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, AppState, Linking } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Zap, ZapOff } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';

export default function CameraPage() {
  // 1. Permissions & Device
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(true);
  const isActive = isFocused && isAppActive;

  // 2. États
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [zoom, setZoom] = useState(1); // Zoom par défaut 1x
  
  const cameraRef = useRef<Camera>(null);
  const router = useRouter();

  // 3. Dimensions 3:4
  const { width: screenWidth } = Dimensions.get('window');
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

  // Cycle de vie
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  if (!hasPermission) return <View style={styles.container} />;
  if (device == null) return <View style={styles.container}><Text style={styles.message}>Pas de caméra</Text></View>;

  // --- ACTIONS ---
  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const handleZoom = (factor: number) => {
      // On s'assure que le device supporte le zoom demandé (sécurité basique)
      const maxZoom = device.maxZoom || 1;
      if (factor <= maxZoom) {
          setZoom(factor);
      }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePhoto({
                flash: flash,
                qualityPrioritization: 'speed',
                enableShutterSound: true
            });
            Alert.alert("Photo prise !", `Chemin : ${photo.path}`);
            console.log("Photo path:", photo.path);
        } catch (e) {
            console.error("Erreur capture:", e);
        }
    }
  };

  return (
    <View style={styles.container}>
        <SunbimHeader showCloseButton={true} onClose={() => router.back()} />

        <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isActive}
                photo={true}
                zoom={zoom}
                // Plus de gestures ici
            />
            
            {/* Overlay Flash */}
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
                    {flash === 'on' ? <Zap color="#FFF" size={24} /> : <ZapOff color="#FFF" size={24} />}
                </TouchableOpacity>
            </View>

            {/* BARRE DE ZOOM (Intégrée en bas de l'image pour l'ergonomie) */}
            <View style={styles.zoomContainer}>
                {[1, 1.5, 2].map((z) => (
                    <TouchableOpacity 
                        key={z} 
                        style={[styles.zoomBtn, zoom === z && styles.zoomBtnActive]} 
                        onPress={() => handleZoom(z)}
                    >
                        <Text style={[styles.zoomText, zoom === z && styles.zoomTextActive]}>
                            {z}x
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <View style={styles.captureInner} />
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
  
  // NOUVEAUX STYLES ZOOM
  zoomContainer: {
      position: 'absolute',
      bottom: 20, // Juste au dessus de la barre noire
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 20,
      padding: 4,
      gap: 8
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
      backgroundColor: 'rgba(255,255,255,0.2)', // Surbrillance légère
  },
  zoomText: {
      color: '#CCC',
      fontWeight: '600',
      fontSize: 12
  },
  zoomTextActive: {
      color: '#FFF', // Texte blanc si actif
      fontWeight: 'bold'
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
  }
});