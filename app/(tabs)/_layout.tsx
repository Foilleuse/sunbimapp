import { Tabs, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Home, Search, Camera, Send, User } from 'lucide-react-native';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false, 
        tabBarShowLabel: false, 
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 85, 
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
          tabBarIcon: ({ color }) => <Search color={color} size={28} />,
        }}
      />

      {/* 3. CAMERA */}
      <Tabs.Screen
        name="camera"
        options={{
          // On cache la barre de navigation pour cet écran uniquement
          tabBarStyle: { display: 'none' },
          tabBarIcon: () => (
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: '#000', 
              justifyContent: 'center', alignItems: 'center',
              marginBottom: 20,
              shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:4
            }}>
              <Camera color="#FFF" size={28} />
            </View>
          ),
        }}
      />

      {/* 4. MESSAGES */}
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ color }) => <Send color={color} size={28} />,
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