import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '../../components/haptic-tab';
import { IconSymbol } from '../../components/ui/icon-symbol';
// Suppression de l'import manquant
// import TabBarBackground from '../../components/ui/tab-bar-background';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Home, Image as ImageIcon, Camera, Users, User } from 'lucide-react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        // Suppression de la propriété qui utilisait le composant manquant
        // tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            // On peut ajouter un fond semi-transparent simple ici si nécessaire
            backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
          },
          default: {},
        }),
      }}>
      
      {/* 1. Feed (Accueil) */}
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />

      {/* 2. Gallery */}
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Galerie',
          tabBarIcon: ({ color }) => <ImageIcon size={24} color={color} />,
        }}
      />

      {/* 3. Camera (Bouton central souvent) */}
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color }) => <Camera size={28} color={color} />, 
        }}
      />

      {/* 4. Amis (Anciennement Messages) */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Amis', // Titre changé
          tabBarIcon: ({ color }) => <Users size={24} color={color} />, // Icône changée pour "Users"
        }}
      />

      {/* 5. Profil */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}