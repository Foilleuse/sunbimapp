import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { X, Bell } from 'lucide-react-native'; 
import { useRouter } from 'expo-router';

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

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  const handleNotifications = () => {
      Alert.alert("Notifications", "Aucune nouvelle notification.");
  };

  return (
    <View style={styles.headerBar}>
      <Text style={styles.headerText}>sunbim</Text>
      
      {showCloseButton && (
        <TouchableOpacity style={styles.leftBtn} onPress={handleClose} hitSlop={10}>
           <X color="#000" size={28} />
        </TouchableOpacity>
      )}

      {/* ZONE DROITE : Uniquement Notification si demandé */}
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
  headerText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF', 
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  leftBtn: {
    position: 'absolute',
    left: 20,
    bottom: 15,
  },
  rightBtn: {
    position: 'absolute',
    right: 20,
    bottom: 15,
  },
});