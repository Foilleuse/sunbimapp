import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { X, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext'; // On récupère le contexte

interface SunbimHeaderProps {
  showCloseButton?: boolean;
  onClose?: () => void;
  showProfileButton?: boolean; // Nouvelle option pour activer/désactiver le bouton profil
}

export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ 
  showCloseButton, 
  onClose,
  showProfileButton = true // Par défaut, on affiche le profil
}) => {
  const router = useRouter();
  const { user, profile } = useAuth(); // On récupère l'user

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  const handleProfile = () => {
    router.push('/profile'); // Navigation vers la page profil
  };

  return (
    <View style={styles.headerBar}>
      <Text style={styles.headerText}>sunbim</Text>
      
      {/* Croix de fermeture (si demandée) */}
      {showCloseButton && (
        <TouchableOpacity style={styles.leftBtn} onPress={handleClose} hitSlop={10}>
           <X color="#000" size={28} />
        </TouchableOpacity>
      )}

      {/* Bouton Profil (en haut à droite) */}
      {showProfileButton && !showCloseButton && (
          <TouchableOpacity style={styles.rightBtn} onPress={handleProfile}>
              {user && profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarTiny} />
              ) : (
                  // Icône générique si pas connecté ou pas d'avatar
                  <View style={[styles.avatarTiny, styles.avatarPlaceholder]}>
                      <User color="#000" size={18} />
                  </View>
              )}
          </TouchableOpacity>
      )}
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
    borderColor: '#EEE'
  }
});