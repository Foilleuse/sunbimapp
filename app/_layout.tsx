import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { useNotificationsSetup } from '../src/hooks/useNotificationsSetup';

export default function RootLayout() {
  useFrameworkReady();
  useNotificationsSetup();

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
