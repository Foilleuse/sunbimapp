import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          
          {/* 1. L'écran de dessin (Accueil) */}
          <Stack.Screen name="index" /> 
          
          {/* 2. Le groupe d'onglets (Feed, Galerie, etc.) */}
          {/* Le nom doit correspondre au nom du dossier : (tabs) */}
          <Stack.Screen name="(tabs)" /> 
          
          <Stack.Screen name="+not-found" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}