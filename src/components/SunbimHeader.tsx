import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface SunbimHeaderProps {
  showCloseButton?: boolean;
  onClose?: () => void; // Action personnalisée (ex: fermer le popup)
}

export const SunbimHeader: React.FC<SunbimHeaderProps> = ({ showCloseButton, onClose }) => {
  const router = useRouter();

  const handlePress = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.headerBar}>
      <Text style={styles.headerText}>sunbim</Text>
      
      {showCloseButton && (
        <TouchableOpacity style={styles.closeBtn} onPress={handlePress} hitSlop={10}>
           {/* Croix noire pour bien contraster sur le header blanc */}
           <X color="#000" size={28} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    width: '100%',
    backgroundColor: '#FFFFFF', 
    paddingTop: 60, // Safe Area standard
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 100, // Toujours au dessus
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5', // Légère séparation
  },
  headerText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF', // Blanc
    // L'Ombre Signature
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    bottom: 15,
  },
});