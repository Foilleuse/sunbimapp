import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { AuthProvider } from '../src/contexts/AuthContext';
import { useNotificationsSetup } from '../src/hooks/useNotificationsSetup';

export default function RootLayout() {
  // Activation des notifications au lancement de l'app
  useNotificationsSetup();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
            <Stack 
              screenOptions={{ 
                headerShown: false,
                animation: 'none',     // Par défaut : Pas d'animation (Pour Index -> Feed)
                gestureEnabled: false 
              }}
            >
              <Stack.Screen name="index" /> 
              <Stack.Screen name="(tabs)" /> 
              
              <Stack.Screen 
                name="profile" 
                options={{
                    presentation: 'modal', // Ouvre la page comme une fenêtre pop-up
                    animation: 'default',  // Réactive l'animation pour le profil
                    gestureEnabled: true   // Permet de fermer en glissant vers le bas
                }} 
              />
              
              <Stack.Screen name="+not-found" />
            </Stack>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}