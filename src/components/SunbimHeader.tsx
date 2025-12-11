import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { X, Bell, User } from 'lucide-react-native'; 
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';

interface SunbimHeaderProps {
  showCloseButton?: boolean;
  onClose?: () => void;
  showNotificationButton?: boolean; 
  showProfileButton?: boolean; 
}

export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ 
  showCloseButton, 
  onClose,
  showNotificationButton = false,
  showProfileButton = false,
}) => {
  const router = useRouter();

  const updateLabel = Updates.updateId ? `v.${Updates.updateId.substring(0, 6)}` : 'Dev Mode';

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  const handleNotifications = () => {
      Alert.alert("Notifications", "Aucune nouvelle notification.");
  };

  const handleProfile = () => {
      router.push('/(tabs)/profile');
  };

  return (
    <View style={styles.header} pointerEvents="box-none">
      {/* Conteneur Titre + Version */}
      <View style={styles.titleContainer}>
          <Text style={styles.headerText}>nyola</Text>
          <Text style={styles.versionText}>{updateLabel}</Text>
      </View>
      
      {showCloseButton && (
        <TouchableOpacity 
          style={styles.leftBtn} 
          onPress={handleClose} 
          hitSlop={10}
          pointerEvents="auto" // Important pour réactiver le clic
        >
           <X color="#FFF" size={28} />
        </TouchableOpacity>
      )}

      <View style={styles.rightBtn} pointerEvents="box-none">
          {showNotificationButton && (
              <TouchableOpacity 
                onPress={handleNotifications} 
                hitSlop={10} 
                style={styles.iconSpacing}
                pointerEvents="auto"
              >
                  <Bell color="#FFF" size={26} />
              </TouchableOpacity>
          )}
          
          {showProfileButton && (
              <TouchableOpacity 
                onPress={handleProfile} 
                hitSlop={10}
                pointerEvents="auto"
              >
                  <User color="#FFF" size={26} />
              </TouchableOpacity>
          )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Vos styles demandés
  header: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    paddingTop: 60, 
    paddingBottom: 15, 
    alignItems: 'center', 
    zIndex: 10, 
    pointerEvents: 'none' // Le conteneur ne bloque pas les clics (géré par box-none dans le JSX)
  },
  headerText: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#FFFFFF', 
    textShadowColor: 'rgba(0,0,0,0.5)', 
    textShadowOffset: { width: 2, height: 2 }, 
    textShadowRadius: 0 
  },
  versionText: { 
    fontSize: 10, 
    color: 'rgba(255,255,255,0.5)', 
    marginTop: 2, 
    textShadowColor: 'rgba(0,0,0,0.8)', 
    textShadowOffset: { width: 1, height: 1 }, 
    textShadowRadius: 1 
  },

  // Styles structurels pour les boutons
  titleContainer: {
    alignItems: 'center',
  },
  leftBtn: {
    position: 'absolute',
    left: 20,
    bottom: 20, // Ajusté pour s'aligner avec le nouveau padding
  },
  rightBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20, // Ajusté pour s'aligner avec le nouveau padding
    flexDirection: 'row',
  },
  iconSpacing: {
    marginRight: 15,
  }
});