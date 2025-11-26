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
            animation: 'none',     // Transition instantanée
            gestureEnabled: false  // Pas de swipe back
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