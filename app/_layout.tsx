import { Stack } from 'expo-router';
// On retire useEffect, useState et les imports de l'OTA
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

export default function RootLayout() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" /> 
          <Stack.Screen name="feed" /> {/* Ajout du feed pour la navigation */}
          <Stack.Screen name="+not-found" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}