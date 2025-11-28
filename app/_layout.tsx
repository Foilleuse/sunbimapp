import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
// On n'importe plus ErrorBoundary pour l'instant
// import { ErrorBoundary } from '../src/components/ErrorBoundary'; 

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* On retire les balises <ErrorBoundary> */}
        <AuthProvider>
            <Stack 
              screenOptions={{ 
                headerShown: false,
                animation: 'none',
                gestureEnabled: false 
              }}
            >
              <Stack.Screen name="index" /> 
              <Stack.Screen name="(tabs)" /> 
              
              <Stack.Screen 
                name="profile" 
                options={{
                    presentation: 'modal',
                    animation: 'default',
                    gestureEnabled: true
                }} 
              />
              
              <Stack.Screen name="+not-found" />
            </Stack>
        </AuthProvider>
      {/* </ErrorBoundary> */}
    </GestureHandlerRootView>
  );
}