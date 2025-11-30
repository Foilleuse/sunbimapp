import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, AppState, Linking } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Zap, ZapOff } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';

export default function CameraPage() {
  const { hasPermission, requestPermission } = useCameraPermission();
  
  // On demande spécifiquement la caméra arrière
  const device = useCameraDevice('back');
  
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(true);
  const isActive = isFocused && isAppActive;

  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [zoom, setZoom] = useState(1);
  
  const cameraRef = useRef<Camera>(null);
  const router = useRouter();

  const { width: screenWidth } = Dimensions.get('window');
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

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
  if (device == null) return <View style={styles.container}><Text style={styles.message}>Chargement caméra...</Text></View>;

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const handleZoom = (factor: number) => {
      console.log("Zoom demandé :", factor);
      
      const minZoom = device.minZoom ?? 1;
      const maxZoom = device.maxZoom ?? 1;
      
      // Sécurité : on reste dans les bornes physiques de l'appareil
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
                video={false} // Optimisation : on ne veut que la photo
                audio={false} // Pas besoin de micro
                zoom={zoom}
            />
            
            {/* Overlay Flash */}
            <View style={styles.overlay} pointerEvents="box-none">
                <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
                    {flash === 'on' ? <Zap color="#FFF" size={24} /> : <ZapOff color="#FFF" size={24} />}
                </TouchableOpacity>
            </View>

            {/* BARRE DE ZOOM (Boutons) */}
            <View style={styles.zoomContainer}>
                {[1, 1.5, 2].map((z) => (
                    <TouchableOpacity 
                        key={z} 
                        style={[styles.zoomBtn, zoom === z && styles.zoomBtnActive]} 
                        onPress={() => handleZoom(z)}
                        activeOpacity={0.7}
                        // Zone tactile élargie pour faciliter le clic
                        hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
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
            
            {/* Debug Info : Pour prouver que c'est bien Vision Camera */}
            <Text style={styles.debugText}>
               {device.name} • Max Zoom: {device.maxZoom?.toFixed(1)}x
            </Text>
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
      zIndex: 10,
  },
  iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  
  zoomContainer: {
      position: 'absolute',
      bottom: 20, 
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 25,
      padding: 6,
      gap: 12, // Espacement un peu plus large
      zIndex: 20,
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
      fontSize: 13
  },
  zoomTextActive: {
      color: '#FFF', 
      fontWeight: 'bold',
      fontSize: 14
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
  debugText: {
      position: 'absolute',
      bottom: 10,
      color: '#333',
      fontSize: 10
  }
});