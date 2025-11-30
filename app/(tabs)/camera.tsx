import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Zap, ZapOff } from 'lucide-react-native';
import { SunbimHeader } from '../../src/components/SunbimHeader';

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  const { width: screenWidth } = Dimensions.get('window');
  // Format 3:4 (Portrait)
  const CAMERA_HEIGHT = screenWidth * (4 / 3);

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
    <View style={styles.container}>
        <SunbimHeader showCloseButton={true} onClose={() => router.back()} />

        <View style={[styles.cameraContainer, { width: screenWidth, height: CAMERA_HEIGHT }]}>
            <CameraView 
                ref={cameraRef}
                style={{ flex: 1 }} 
                facing="back"
                flash={flash}
                // C'EST ICI : Zoom natif géré par le système (plus fluide, pas de crash)
                enableZoomGesture={true} 
                animateShutter={false}
            />
            
            {/* Overlay Flash */}
            <View style={styles.overlay} pointerEvents="box-none">
                <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
                    {flash === 'on' ? <Zap color="#FFF" size={24} /> : <ZapOff color="#FFF" size={24} />}
                </TouchableOpacity>
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
  }
});