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
  
  // Si pas de device, on affiche un message (évite écran noir silencieux)
  if (device == null) return <View style={styles.container}><Text style={styles.message}>Chargement caméra...</Text></View>;

  // --- ACTIONS ---
  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const handleZoom = (factor: number) => {
      if (!device) return;
      
      const minZoom = device.minZoom ?? 1;
      const maxZoom = device.maxZoom ?? 1;
      
      // On s'assure que le zoom demandé est possible pour cet appareil
      // (Ex: si on demande x2 mais que le max est x1.5)
      const targetZoom = Math.max(minZoom, Math.min(factor, maxZoom));
      
      setZoom(targetZoom);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePhoto({
                flash: flash,
                enableShutterSound: true
            });
            Alert.alert("Photo prise !", `Chemin : ${photo.path}`);
            console.log("Photo path:", photo.path);
        } catch (e) {
            console.error("Erreur capture:", e);
            Alert.alert("Erreur", "La photo n'a pas pu être prise.");
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
                zoom={zoom} // Piloté par les boutons
                enableZoomGesture={false} // Désactive le pinch natif pour éviter les conflits
            />
            
            {/* Overlay Flash */}
            <View style={styles.overlay} pointerEvents="box-none">
                <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
                    {flash === 'on' ? <Zap color="#FFF" size={24} /> : <ZapOff color="#FFF" size={24} />}
                </TouchableOpacity>
            </View>

            {/* BARRE DE ZOOM (Boutons) - Sécurisé avec zIndex */}
            <View style={styles.zoomContainer}>
                {[1, 1.5, 2].map((z) => (
                    <TouchableOpacity 
                        key={z} 
                        style={[styles.zoomBtn, zoom === z && styles.zoomBtnActive]} 
                        onPress={() => handleZoom(z)}
                        activeOpacity={0.7}
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
      zIndex: 10, // S'assure que c'est au-dessus
  },
  iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  
  // STYLES ZOOM
  zoomContainer: {
      position: 'absolute',
      bottom: 20, 
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 25,
      padding: 6,
      gap: 10,
      zIndex: 20, // Très important pour être cliquable
  },
  zoomBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent'
  },
  zoomBtnActive: {
      backgroundColor: 'rgba(255,255,255,0.3)', 
  },
  zoomText: {
      color: '#DDD',
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