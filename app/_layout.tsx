import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
// AJOUT
import { AuthProvider } from '../src/contexts/AuthContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        {/* AJOUT DU PROVIDER AUTOUR DE LA STACK */}
        <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" /> 
            <Stack.Screen name="(tabs)" /> 
            <Stack.Screen name="+not-found" />
            </Stack>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}