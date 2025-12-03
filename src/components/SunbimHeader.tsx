import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { X, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';

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

  const handleProfilePress = () => {
      router.push('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerContainer}>
        
        {/* Partie gauche : vide ou bouton profil */}
        <View style={styles.leftContainer}>
            {showProfileButton && (
                <TouchableOpacity onPress={handleProfilePress} style={styles.iconButton}>
                    <User color="#000" size={24} />
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
    backgroundColor: '#FFF', // Fond blanc explicite
  },
  leftContainer: {
      width: 40,
      alignItems: 'flex-start'
  },
  rightContainer: {
      width: 40,
      alignItems: 'flex-end'
  },
  headerTitle: {
    fontSize: 28, // Taille comme sur l'index
    fontWeight: '900', // Gras comme sur l'index
    color: '#000',
    letterSpacing: -1, // Style compact
    textAlign: 'center',
  },
  iconButton: {
    padding: 5,
  }
});