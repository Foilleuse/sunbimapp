import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Platform, StyleSheet } from 'react-native';
import { Home, Image as ImageIcon, Camera, Users, User } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
// Import nécessaire pour l'effet de flou
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  // Détection de la page Feed pour adapter le style du bouton caméra
  const isFeed = pathname === '/feed';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Style par défaut pour les autres onglets (fond blanc opaque)
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: Platform.OS === 'ios' ? 85 : 60,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#CCCCCC',
      }}
    >
      {/* 1. FEED - Barre transparente (déjà géré sans flou pour l'instant, style spécifique) */}
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={28} />,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            height: Platform.OS === 'ios' ? 85 : 60,
            paddingTop: 10,
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarActiveTintColor: '#FFFFFF', 
          tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        }}
      />

      {/* 2. GALERIE - Barre Transparente + Flou */}
      <Tabs.Screen
        name="gallery"
        options={{
          tabBarIcon: ({ color }) => <ImageIcon color={color} size={28} />,
          // Position absolue pour flotter au-dessus du contenu
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent', // Important pour voir le flou
            borderTopWidth: 0, // Pas de bordure pour un look épuré
            elevation: 0,
            height: Platform.OS === 'ios' ? 85 : 60,
            paddingTop: 10,
            bottom: 0,
            left: 0,
            right: 0,
          },
          // Ajout de l'arrière-plan flouté
          tabBarBackground: () => (
            <BlurView 
              intensity={80} 
              tint="light" 
              style={StyleSheet.absoluteFill} 
            />
          ),
        }}
      />

      {/* 3. CAMERA (Bouton central) */}
      <Tabs.Screen
        name="camera"
        options={{
          tabBarStyle: { display: 'none' },
          tabBarIcon: () => (
            <View style={[
              {
                width: 56, height: 56, borderRadius: 28,
                justifyContent: 'center', alignItems: 'center',
                marginBottom: Platform.OS === 'ios' ? 30 : 20,
              },
              isFeed ? {
                // Style spécifique Feed : Pas de fond noir, fond transparent
                backgroundColor: 'transparent',
                shadowColor: "transparent",
                elevation: 0
              } : {
                // Style par défaut : Cercle noir avec ombre
                backgroundColor: '#000', 
                shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:4,
                elevation: 5
              }
            ]}>
              <Camera color="#FFF" size={28} />
            </View>
          ),
        }}
      />

      {/* 4. AMIS */}
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ color }) => <Users color={color} size={28} />,
        }}
      />

      {/* 5. PROFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={28} />,
        }}
      />
    </Tabs>
  );
}