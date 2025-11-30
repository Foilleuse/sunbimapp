import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, AppState, Linking } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SunbimHeader } from '../../src/components/SunbimHeader';

export default function CameraPage() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(true);
  const isActive = isFocused && isAppActive;

  const [zoom, setZoom] = useState(1);
  
  const cameraRef = useRef<Camera>(null);
  const router = useRouter();

  const { width: screenWidth } = Dimensions.get('window');
  // Format 3:4 (Portrait)
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

  const handleZoom = (factor: number) => {
      const minZoom = device.minZoom ?? 1;
      const maxZoom = device.maxZoom ?? 1;
      const targetZoom = Math.max(minZoom, Math.min(factor, maxZoom));
      setZoom(targetZoom);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
        try {
            const photo = await cameraRef.current.takePhoto({
                flash: 'off', // Flash forcé à OFF
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
                zoom={zoom}
                enableZoomGesture={false} 
            />
            {/* Plus d'overlay flash ici */}
        </View>

        {/* ZONE DE CONTRÔLE (Fond noir en bas) */}
        <View style={styles.controlsContainer}>
            
            {/* BARRE DE ZOOM (Déplacée ici pour être sûr qu'elle soit visible) */}
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

            {/* DÉCLENCHEUR */}
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
    // Pas de position relative/absolute complexe ici pour éviter les zIndex perdus
  },
  message: { textAlign: 'center', color: '#FFF', marginTop: 100 },
  
  // STYLES CONTROLS (Bas de l'écran)
  controlsContainer: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'space-evenly', // Répartit l'espace entre zoom et bouton
      paddingBottom: 20
  },
  
  zoomContainer: {
      flexDirection: 'row',
      backgroundColor: '#222', // Fond gris foncé pour bien voir les boutons
      borderRadius: 20,
      padding: 4,
      gap: 12,
      marginBottom: 10
  },
  zoomBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent'
  },
  zoomBtnActive: {
      backgroundColor: '#444', 
  },
  zoomText: {
      color: '#888',
      fontWeight: '600',
      fontSize: 13
  },
  zoomTextActive: {
      color: '#FFF', 
      fontWeight: 'bold',
      fontSize: 14
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