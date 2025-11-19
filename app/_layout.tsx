import { Slot } from 'expo-router';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useNotificationsSetup } from '../src/hooks/useNotificationsSetup';

export default function RootLayout() {
  useFrameworkReady();
  useNotificationsSetup();

  return <Slot />;
}
