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
    // Ombre pour iOS (comme demandé précédemment)
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
    // On n'applique pas l'ombre portée blanche du texte ici car le fond est déjà blanc
    // L'index avait un fond noir/image, donc une ombre portée sur le texte.
    // Ici, on peut ajouter une légère ombre portée noire pour le relief si souhaité, 
    // ou garder simple comme demandé "reprendre l'écriture".
    // Je reprends les propriétés textShadow de l'index mais adaptées pour fond clair ou identiques si c'est le style voulu.
    textShadowColor: 'rgba(0,0,0,0.1)', // Ombre très légère
    textShadowOffset: { width: 1, height: 1 }, 
    textShadowRadius: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: 5,
  }
});