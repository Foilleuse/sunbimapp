import { Tabs, useRouter } from 'expo-router';
import { View, Platform } from 'react-native';
import { Home, Image as ImageIcon, Camera, Users, User } from 'lucide-react-native';
// Suppression des imports qui posaient problème
// import { HapticTab } from '../../components/haptic-tab';
// import { IconSymbol } from '../../components/ui/icon-symbol';
// import TabBarBackground from '../../components/ui/tab-bar-background';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Restauration du style original demandé
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: Platform.OS === 'ios' ? 85 : 60, // Ajustement hauteur selon OS
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#CCCCCC',
      }}
    >
      {/* 1. FEED */}
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={28} />,
        }}
      />

      {/* 2. GALERIE */}
      <Tabs.Screen
        name="gallery"
        options={{
          tabBarIcon: ({ color }) => <ImageIcon color={color} size={28} />,
        }}
      />

      {/* 3. CAMERA (Bouton central en relief) */}
      <Tabs.Screen
        name="camera"
        options={{
          // On cache la barre de navigation pour l'écran caméra lui-même (comme avant)
          tabBarStyle: { display: 'none' },
          tabBarIcon: () => (
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: '#000', 
              justifyContent: 'center', alignItems: 'center',
              marginBottom: Platform.OS === 'ios' ? 30 : 20, // Remonter le bouton
              shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:4,
              elevation: 5
            }}>
              <Camera color="#FFF" size={28} />
            </View>
          ),
        }}
      />

      {/* 4. AMIS (Modifié depuis Messages) */}
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