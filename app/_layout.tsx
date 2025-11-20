import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { useFrameworkReady } from '../hooks/useFrameworkReady';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    async function checkForUpdates() {
      if (Platform.OS === 'web' || __DEV__) {
        console.log('ℹ️ Sunbim OTA: Skipping update check (web or dev mode)');
        return;
      }

      if (!Updates.isEnabled) {
        console.log('⚠️ Sunbim OTA: Updates are disabled');
        return;
      }

      try {
        console.log('🔄 Sunbim OTA: Running update check on load');
        console.log('📱 Sunbim OTA: Runtime version:', Updates.runtimeVersion);
        console.log('📱 Sunbim OTA: Channel:', Updates.channel);
        console.log('📱 Sunbim OTA: Update ID:', Updates.updateId);

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.log('✅ Sunbim OTA: Update available! Fetching...');
          await Updates.fetchUpdateAsync();
          console.log('✅ Sunbim OTA: Update downloaded, reloading...');
          await Updates.reloadAsync();
        } else {
          console.log('ℹ️ Sunbim OTA: App is up to date');
        }
      } catch (error) {
        console.error('❌ Sunbim OTA: Error checking for updates', error);
      }
    }

    checkForUpdates();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
