import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as Updates from 'expo-updates';

export function OTADebugPanel() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUpdateInfo();
  }, []);

  const loadUpdateInfo = () => {
    try {
      if (Platform.OS === 'web') {
        setUpdateInfo({
          isEnabled: false,
          channel: 'N/A (Web)',
          runtimeVersion: 'N/A',
          updateId: 'N/A',
          isEmbeddedLaunch: true
        });
        return;
      }

      setUpdateInfo({
        isEnabled: Updates.isEnabled,
        channel: Updates.channel || 'default',
        runtimeVersion: Updates.runtimeVersion || 'unknown',
        updateId: Updates.updateId || 'embedded',
        isEmbeddedLaunch: Updates.isEmbeddedLaunch
      });
    } catch (err) {
      console.error('Error loading update info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUpdateInfo({
        isEnabled: false,
        channel: 'Error',
        runtimeVersion: 'Error',
        updateId: 'Error',
        isEmbeddedLaunch: true
      });
    }
  };

  const handleCheckForUpdate = async () => {
    if (Platform.OS === 'web') {
      setLastCheck('OTA not available on web');
      return;
    }

    try {
      setIsChecking(true);
      setLastCheck('Checking...');

      console.log('🔄 Sunbim OTA: Manual update check started');

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setLastCheck(`Update available! Downloading...`);
        console.log('✅ Sunbim OTA: Update available, downloading...');

        await Updates.fetchUpdateAsync();
        setLastCheck('Update downloaded! Tap Reload.');
        console.log('✅ Sunbim OTA: Update downloaded successfully');
      } else {
        setLastCheck('No update available');
        console.log('ℹ️ Sunbim OTA: No update available');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLastCheck(`Error: ${message}`);
      console.error('❌ Sunbim OTA: Error checking for updates', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReload = async () => {
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }

    try {
      console.log('🔄 Sunbim OTA: Reloading app...');
      await Updates.reloadAsync();
    } catch (error) {
      console.error('❌ Sunbim OTA: Error reloading', error);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>⚠️ OTA Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!updateInfo) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 OTA Debug Panel</Text>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Updates Enabled:</Text>
        <Text style={[styles.value, updateInfo.isEnabled ? styles.success : styles.error]}>
          {updateInfo.isEnabled ? '✅ YES' : '❌ NO'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Channel:</Text>
        <Text style={styles.value}>{updateInfo.channel}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Runtime:</Text>
        <Text style={styles.value}>{updateInfo.runtimeVersion}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Update ID:</Text>
        <Text style={styles.valueSmall} numberOfLines={1}>
          {updateInfo.updateId}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Embedded Launch:</Text>
        <Text style={styles.value}>
          {updateInfo.isEmbeddedLaunch ? 'Yes (build)' : 'No (OTA)'}
        </Text>
      </View>

      {lastCheck ? (
        <Text style={styles.lastCheck}>{lastCheck}</Text>
      ) : null}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.checkButton, isChecking && styles.buttonDisabled]}
          onPress={handleCheckForUpdate}
          disabled={isChecking}
        >
          <Text style={styles.buttonText}>
            {isChecking ? 'Checking...' : 'Check Update'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.reloadButton]}
          onPress={handleReload}
        >
          <Text style={styles.buttonText}>Reload</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: '#999',
    flex: 1,
  },
  value: {
    fontSize: 11,
    color: '#fff',
    flex: 1,
    textAlign: 'right',
  },
  valueSmall: {
    fontSize: 9,
    color: '#fff',
    flex: 1,
    textAlign: 'right',
  },
  success: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  error: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  lastCheck: {
    fontSize: 10,
    color: '#fbbf24',
    marginTop: 8,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  checkButton: {
    backgroundColor: '#3b82f6',
  },
  reloadButton: {
    backgroundColor: '#22c55e',
  },
  buttonDisabled: {
    backgroundColor: '#64748b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 10,
    color: '#f87171',
    marginTop: 4,
  },
});
