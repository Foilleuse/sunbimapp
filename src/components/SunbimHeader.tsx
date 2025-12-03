import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { X, Bell } from 'lucide-react-native'; 
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';

interface SunbimHeaderProps {
  showCloseButton?: boolean;
  onClose?: () => void;
  showNotificationButton?: boolean; 
}

export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ 
  showCloseButton, 
  onClose,
  showNotificationButton = false 
}) => {
  const router = useRouter();

  // Récupération de l'ID de mise à jour (ou 'Dev' si en local)
  const updateLabel = Updates.updateId ? `v.${Updates.updateId.substring(0, 6)}` : 'Dev Mode';

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  const handleNotifications = () => {
      Alert.alert("Notifications", "Aucune nouvelle notification.");
  };

  return (
    <View style={styles.headerBar}>
      {/* Conteneur Titre + Version */}
      <View style={styles.titleContainer}>
          <Text style={styles.headerText}>sunbim</Text>
          <Text style={styles.versionText}>{updateLabel}</Text>
      </View>
      
      {showCloseButton && (
        <TouchableOpacity style={styles.leftBtn} onPress={handleClose} hitSlop={10}>
           <X color="#000" size={28} />
        </TouchableOpacity>
      )}

      <View style={styles.rightBtn}>
          {showNotificationButton && (
              <TouchableOpacity onPress={handleNotifications} hitSlop={10}>
                  <Bell color="#000" size={26} />
              </TouchableOpacity>
          )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    width: '100%',
    backgroundColor: '#FFFFFF', 
    paddingTop: 60, 
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 100, 
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5', 
  },
  titleContainer: {
      alignItems: 'center',
  },
  headerText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000', // Noir pour être visible sur fond blanc
    lineHeight: 34,
  },
  versionText: {
      fontSize: 10,
      color: '#999', // Gris discret
      marginTop: -2,
  },
  leftBtn: {
    position: 'absolute',
    left: 20,
    bottom: 20,
  },
  rightBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
});