import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Platform } from 'react-native';
import { Home, Image as ImageIcon, Camera, Users, User } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

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
        // Style par défaut pour les autres onglets (fond blanc)
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
      {/* 1. FEED - Barre transparente */}
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={28} />,
          // Surcharge du style pour cet écran uniquement
          tabBarStyle: {
            position: 'absolute', // Nécessaire pour la transparence sur le contenu
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0, // Pour Android
            height: Platform.OS === 'ios' ? 85 : 60,
            paddingTop: 10,
            bottom: 0,
            left: 0,
            right: 0,
          },
          // On change la couleur des icônes pour qu'elles soient visibles sur le fond bleu/photo
          tabBarActiveTintColor: '#FFFFFF', 
          tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        }}
      />

      {/* 2. GALERIE */}
      <Tabs.Screen
        name="gallery"
        options={{
          tabBarIcon: ({ color }) => <ImageIcon color={color} size={28} />,
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
                // Pas d'ombre/elevation sur le Feed pour ne pas avoir d'artefacts
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