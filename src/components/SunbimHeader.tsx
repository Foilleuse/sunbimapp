import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, Image } from 'react-native';
import { X, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

interface SunbimHeaderProps {
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  showProfileButton?: boolean;
}

export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ 
  title = "sunbim", 
  showCloseButton = false, 
  onClose,
  showProfileButton = false
}) => {
  const router = useRouter();
  const { user, profile } = useAuth(); // On récupère l'utilisateur et le profil

  const handleProfilePress = () => {
      router.push('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerContainer}>
        
        {/* Partie gauche : vide ou bouton profil (avec avatar si connecté) */}
        <View style={styles.leftContainer}>
            {showProfileButton && (
                <TouchableOpacity onPress={handleProfilePress} style={styles.iconButton}>
                    {user && profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatarTiny} />
                    ) : (
                        <View style={[styles.avatarTiny, styles.avatarPlaceholder]}>
                            <User color="#000" size={18} />
                        </View>
                    )}
                </TouchableOpacity>
            )}
        </View>

        {/* Titre central stylisé comme l'index */}
        <Text style={styles.headerTitle}>{title}</Text>

        {/* Partie droite : bouton fermer ou vide */}
        <View style={styles.rightContainer}>
          {showCloseButton && (
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <X color="#000" size={28} />
            </TouchableOpacity>
          )}
        </View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFF',
    // Ombre pour iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    // Ombre pour Android
    elevation: 4,
    zIndex: 100,
  },
  headerContainer: {
    height: Platform.OS === 'ios' ? 50 : 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    backgroundColor: '#FFF', 
  },
  leftContainer: {
      width: 40,
      alignItems: 'flex-start'
  },
  rightContainer: {
      width: 40,
      alignItems: 'flex-end'
  },
  // Style repris de l'index (app/index.tsx)
  headerTitle: {
    fontSize: 32, // Taille augmentée à 32
    fontWeight: '900', // Poids max
    color: '#000', // Noir par défaut (sur fond blanc)
    textShadowColor: 'rgba(0,0,0,0.1)', // Ombre très légère
    textShadowOffset: { width: 1, height: 1 }, 
    textShadowRadius: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: 5,
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