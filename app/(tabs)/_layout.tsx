import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

export default function RootLayout() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Stack 
          screenOptions={{ 
            headerShown: false,
            // 1. Désactive l'animation de slide (Transition instantanée)
            animation: 'none', 
            // 2. Désactive le geste "Retour" natif (Swipe back) pour forcer le flux
            gestureEnabled: false 
          }}
        >
          <Stack.Screen name="index" /> 
          <Stack.Screen name="(tabs)" /> 
          <Stack.Screen name="+not-found" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}