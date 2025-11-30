import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { X, User, Bell } from 'lucide-react-native'; // Ajout de Bell
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext'; 

interface SunbimHeaderProps {
  showCloseButton?: boolean;
  onClose?: () => void;
  showProfileButton?: boolean; 
  showNotificationButton?: boolean; // Nouvelle option pour la cloche
}

export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ 
  showCloseButton, 
  onClose,
  showProfileButton = true,
  showNotificationButton = false // Par défaut inactif
}) => {
  const router = useRouter();
  const { user, profile } = useAuth(); 

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  const handleProfile = () => {
    router.push('/profile'); 
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

      {/* ZONE DROITE : Soit Profil, soit Notification */}
      <View style={styles.rightBtn}>
          {/* Cas 1 : Bouton Notification (Prioritaire si demandé) */}
          {showNotificationButton ? (
              <TouchableOpacity onPress={handleNotifications} hitSlop={10}>
                  <Bell color="#000" size={26} />
              </TouchableOpacity>
          ) : (
              // Cas 2 : Bouton Profil (Si demandé et pas de croix)
              showProfileButton && !showCloseButton && (
                  <TouchableOpacity onPress={handleProfile}>
                      {user && profile?.avatar_url ? (
                          <Image source={{ uri: profile.avatar_url }} style={styles.avatarTiny} />
                      ) : (
                          <View style={[styles.avatarTiny, styles.avatarPlaceholder]}>
                              <User color="#000" size={18} />
                          </View>
                      )}
                  </TouchableOpacity>
              )
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
  avatarTiny: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
    width: 32,
    height: 32,
    borderRadius: 16,
  }
});