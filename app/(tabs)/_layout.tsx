import { Tabs, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Home, Search, Camera, Send, BarChart2 } from 'lucide-react-native';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // On garde tes headers personnalisés
        tabBarShowLabel: false, // Pas de texte, que des icônes (épuré)
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 85, // Hauteur confortable pour le pouce
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#CCCCCC',
      }}
    >
      {/* 1. FEED (Accueil des onglets) */}
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
          tabBarIcon: ({ color }) => <Search color={color} size={28} />,
        }}
      />

      {/* 3. CAMERA (Le bouton central qui renvoie au dessin) */}
      <Tabs.Screen
        name="camera_dummy"
        options={{
          tabBarIcon: () => (
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: '#000', // Noir pour ressortir
              justifyContent: 'center', alignItems: 'center',
              marginBottom: 20,
              shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:4
            }}>
              <Camera color="#FFF" size={28} />
            </View>
          ),
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault(); // Stop ! On n'ouvre pas cet onglet.
            router.push('/');   // On retourne à l'écran de dessin (index).
          },
        })}
      />

      {/* 4. MESSAGERIE */}
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ color }) => <Send color={color} size={28} />,
        }}
      />

      {/* 5. STATISTIQUES */}
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color }) => <BarChart2 color={color} size={28} />,
        }}
      />
    </Tabs>
  );
}